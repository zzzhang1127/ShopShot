from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.schemas.common import ApiResponse
from app.core.exceptions import ShopShotException
from app.schemas.generation import (
    AgentRunRequest,
    AgentCapabilitiesRead,
    QuickGenerateRequest,
    VideoGenerateRequest,
    GenerationTaskRead,
    PromptEnhanceRequest,
    PromptEnhanceRead,
    VideoFromShotsRequest,
)
from app.config import get_settings
from app.agents.director import DirectorAgent
from app.services.generation_service import GenerationService
from app.workers.background_jobs import (
    job_execute_script,
    job_execute_video,
    job_execute_quick,
    job_execute_full,
)

router = APIRouter()
settings = get_settings()


@router.get("/agents/capabilities", response_model=ApiResponse[AgentCapabilitiesRead])
def agent_capabilities():
    return ApiResponse(
        data=AgentCapabilitiesRead(
            wan_prompt_enhance=settings.wan_prompt_enhance_enabled and bool(settings.volc_api_key),
            wan_image=settings.wan_image_enabled and bool(settings.dashscope_api_key),
            wan_video=settings.wan_video_enabled and bool(settings.dashscope_api_key),
            seedance=bool(settings.volc_api_key and settings.doubao_seedance_ep),
            comfyui=settings.comfyui_enabled,
        )
    )


@router.post("/agents/enhance-prompt", response_model=ApiResponse[PromptEnhanceRead])
def enhance_prompt(body: PromptEnhanceRequest):
    from app.agents.prompt_agent import PromptAgent

    agent = PromptAgent()
    enhanced = agent.enhance_text(
        body.text,
        mode=body.mode if body.mode in ("i2v", "t2v") else "i2v",
        product_context=body.product_context,
    )
    return ApiResponse(
        data=PromptEnhanceRead(
            original=body.text,
            enhanced=enhanced,
            mode=body.mode,
        )
    )


def _apply_asset_based_mapping(db: Session, project_id: int, script_id: int) -> None:
    """Server-side fallback mapping for asset_based pipeline preset."""
    from app.models import Asset, AssetType, Shot

    image_assets = (
        db.execute(
            select(Asset)
            .where(
                Asset.project_id == project_id,
                Asset.type == AssetType.IMAGE,
                Asset.source == "upload",
            )
            .order_by(Asset.id.asc())
        )
        .scalars()
        .all()
    )
    if not image_assets:
        return

    shots = (
        db.execute(select(Shot).where(Shot.script_id == script_id).order_by(Shot.sequence.asc(), Shot.id.asc()))
        .scalars()
        .all()
    )
    if not shots:
        return

    changed = False
    for idx, shot in enumerate(shots):
        mapped = image_assets[idx % len(image_assets)]
        if shot.reference_asset_id != mapped.id:
            shot.reference_asset_id = mapped.id
            changed = True

    if changed:
        db.commit()


def _task_response(db: Session, task_id: str) -> ApiResponse[GenerationTaskRead]:
    svc = GenerationService(db)
    task = svc.get(task_id)
    return ApiResponse(data=GenerationTaskRead.model_validate(task))


@router.post("/agents/run", response_model=ApiResponse[GenerationTaskRead])
def run_agent_workflow(
    body: AgentRunRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    from app.models import Project

    project = db.get(Project, body.project_id)
    if project:
        if body.target_ratio:
            project.target_ratio = body.target_ratio
        if body.target_resolution:
            project.target_resolution = body.target_resolution
        db.commit()

    agent = DirectorAgent(db)
    duration = body.duration or 20
    extra: dict = {"duration": duration}
    if body.pipeline_preset:
        extra["pipeline_preset"] = body.pipeline_preset
    if body.target_ratio:
        extra["target_ratio"] = body.target_ratio
    task_id = agent.start_full(body.project_id, extra=extra)
    background_tasks.add_task(job_execute_full, task_id, body.project_id, duration)
    return _task_response(db, task_id)


@router.post("/agents/run/{project_id}/script", response_model=ApiResponse[GenerationTaskRead])
def run_script_agent(
    project_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    agent = DirectorAgent(db)
    task_id = agent.start_script_only(project_id)
    background_tasks.add_task(job_execute_script, task_id, project_id)
    return _task_response(db, task_id)


@router.post("/agents/run/{project_id}/video", response_model=ApiResponse[GenerationTaskRead])
def run_video_agent(
    project_id: int,
    background_tasks: BackgroundTasks,
    body: VideoGenerateRequest | None = None,
    db: Session = Depends(get_db),
):
    from app.models import Script
    from app.core.exceptions import ShopShotException

    script = None
    if body and body.script_id:
        script = db.get(Script, body.script_id)
        if not script or script.project_id != project_id:
            raise ShopShotException(400, "Script not found for this project")
    if not script:
        result = db.execute(
            select(Script)
            .where(Script.project_id == project_id)
            .order_by(Script.id.desc())
            .limit(1)
        )
        script = result.scalar_one_or_none()
    if not script:
        raise ShopShotException(400, "No script found for project")

    duration = body.duration if body and body.duration else 20
    if body:
        from app.models import Project, ProjectStatus

        project = db.get(Project, project_id)
        if project:
            if body.pipeline_preset:
                project.video_mode = body.pipeline_preset
            if body.target_ratio:
                project.target_ratio = body.target_ratio
            if body.target_resolution:
                project.target_resolution = body.target_resolution
            project.status = ProjectStatus.GENERATING
            db.commit()
        if body.pipeline_preset == "asset_based":
            _apply_asset_based_mapping(db, project_id, script.id)

    extra: dict = {"duration": duration}
    if body:
        if body.pipeline_preset:
            extra["pipeline_preset"] = body.pipeline_preset
        if body.target_ratio:
            extra["target_ratio"] = body.target_ratio
    agent = DirectorAgent(db)
    task_id = agent.start_video_only(project_id, script.id, duration, extra=extra)
    background_tasks.add_task(job_execute_video, task_id, project_id, script.id, duration)
    return _task_response(db, task_id)


@router.post("/agents/run/{project_id}/quick", response_model=ApiResponse[GenerationTaskRead])
def run_quick_agent(
    project_id: int,
    body: QuickGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    from app.models import Project, ProjectStatus

    project = db.get(Project, project_id)
    if project:
        if body.pipeline_preset:
            project.video_mode = body.pipeline_preset
        if body.target_ratio:
            project.target_ratio = body.target_ratio
        if body.target_resolution:
            project.target_resolution = body.target_resolution
        project.status = ProjectStatus.GENERATING
        db.commit()

    # 快捷模式也必须遵守 Director → Script → Video → PostProcess 全链路。
    # prompt 已在前端写入 Project.product_info，这里只补写一次，避免绕过剧本/分镜。
    if project and body.prompt:
        project.product_info = body.prompt
        db.commit()

    agent = DirectorAgent(db)
    duration = body.duration or 20
    extra: dict = {"duration": duration}
    if body.pipeline_preset:
        extra["pipeline_preset"] = body.pipeline_preset
    if body.target_ratio:
        extra["target_ratio"] = body.target_ratio
    task_id = agent.start_full(project_id, extra=extra)
    background_tasks.add_task(job_execute_full, task_id, project_id, duration)
    return _task_response(db, task_id)


@router.post("/agents/generate-video-from-shots", response_model=ApiResponse[GenerationTaskRead])
def generate_video_from_shots(
    body: VideoFromShotsRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Create Script + Shots in DB from user-provided prompt data,
    then start background video generation.
    """
    from app.models import Script, Shot, ShotStatus, Project, ProjectStatus
    from app.services.script_service import ScriptService

    if not body.shots:
        raise ShopShotException(400, "shots 不能为空")

    svc = ScriptService(db)
    script = svc.create(project_id=body.project_id, video_type="product_show")
    svc.update(script.id, title="自定义分镜脚本", status="confirmed")

    shot_count = len(body.shots)
    per_duration = body.duration // shot_count if shot_count > 0 else body.duration

    for idx, shot_data in enumerate(body.shots):
        ref_id = (
            body.product_asset_ids[idx % len(body.product_asset_ids)]
            if body.product_asset_ids
            else None
        )
        shot = Shot(
            script_id=script.id,
            project_id=body.project_id,
            shot_id=shot_data.shot_id,
            image_prompt=shot_data.image_prompt,
            action_prompt=shot_data.action_prompt,
            words=shot_data.words,
            duration=per_duration,
            sequence=idx,
            status=ShotStatus.PENDING,
            reference_asset_id=ref_id,
        )
        db.add(shot)
    db.commit()

    project = db.get(Project, body.project_id)
    if project:
        project.target_ratio = body.aspect_ratio
        project.status = ProjectStatus.GENERATING
        db.commit()

    agent = DirectorAgent(db)
    task_id = agent.start_video_only(
        body.project_id,
        script.id,
        body.duration,
        extra={"pipeline_preset": "asset_based", "target_ratio": body.aspect_ratio},
    )
    background_tasks.add_task(
        job_execute_video, task_id, body.project_id, script.id, body.duration
    )
    return _task_response(db, task_id)
