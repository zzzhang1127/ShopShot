from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.schemas.common import ApiResponse
from app.schemas.generation import (
    AgentRunRequest,
    QuickGenerateRequest,
    VideoGenerateRequest,
    GenerationTaskRead,
)
from app.agents.director import DirectorAgent
from app.services.generation_service import GenerationService
from app.workers.background_jobs import (
    job_execute_script,
    job_execute_video,
    job_execute_quick,
    job_execute_full,
)

router = APIRouter()


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
    task_id = agent.start_full(body.project_id)
    background_tasks.add_task(job_execute_full, task_id, body.project_id, body.duration or 15)
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

    result = db.execute(
        select(Script).where(Script.project_id == project_id).order_by(Script.id.desc()).limit(1)
    )
    script = result.scalar_one_or_none()
    if not script:
        raise ShopShotException(400, "No script found for project")

    duration = body.duration if body and body.duration else 15
    if body:
        from app.models import Project

        project = db.get(Project, project_id)
        if project:
            if body.target_ratio:
                project.target_ratio = body.target_ratio
            if body.target_resolution:
                project.target_resolution = body.target_resolution
            db.commit()

    agent = DirectorAgent(db)
    task_id = agent.start_video_only(project_id, script.id, duration)
    background_tasks.add_task(job_execute_video, task_id, project_id, script.id, duration)
    return _task_response(db, task_id)


@router.post("/agents/run/{project_id}/quick", response_model=ApiResponse[GenerationTaskRead])
def run_quick_agent(
    project_id: int,
    body: QuickGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    from app.models import Project

    project = db.get(Project, project_id)
    if project:
        if body.target_ratio:
            project.target_ratio = body.target_ratio
        if body.target_resolution:
            project.target_resolution = body.target_resolution
        db.commit()

    # 快捷模式也必须遵守 Director → Script → Video → PostProcess 全链路。
    # prompt 已在前端写入 Project.product_info，这里只补写一次，避免绕过剧本/分镜。
    if project and body.prompt:
        project.product_info = body.prompt
        db.commit()

    agent = DirectorAgent(db)
    duration = body.duration or 15
    task_id = agent.start_full(project_id)
    background_tasks.add_task(job_execute_full, task_id, project_id, duration)
    return _task_response(db, task_id)
