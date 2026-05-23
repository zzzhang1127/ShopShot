from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.common import ApiResponse
from app.schemas.generation import AgentRunRequest, QuickGenerateRequest, GenerationTaskRead
from app.agents.director import DirectorAgent
from app.services.generation_service import GenerationService

router = APIRouter()


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
    task_id = agent.run(body.project_id)
    svc = GenerationService(db)
    task = svc.get(task_id)
    return ApiResponse(data=GenerationTaskRead.model_validate(task))


@router.post("/agents/run/{project_id}/script", response_model=ApiResponse[GenerationTaskRead])
def run_script_agent(
    project_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    agent = DirectorAgent(db)
    task_id = agent.run_script_only(project_id)
    svc = GenerationService(db)
    task = svc.get(task_id)
    return ApiResponse(data=GenerationTaskRead.model_validate(task))


@router.post("/agents/run/{project_id}/video", response_model=ApiResponse[GenerationTaskRead])
def run_video_agent(
    project_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    from sqlalchemy import select
    from app.models import Script
    result = db.execute(
        select(Script).where(Script.project_id == project_id).order_by(Script.id.desc())
    )
    script = result.scalar_one_or_none()
    if not script:
        from app.core.exceptions import ShopShotException
        raise ShopShotException(400, "No script found for project")
    agent = DirectorAgent(db)
    task_id = agent.run_video_only(project_id, script.id)
    svc = GenerationService(db)
    task = svc.get(task_id)
    return ApiResponse(data=GenerationTaskRead.model_validate(task))


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

    agent = DirectorAgent(db)
    task_id = agent.run_quick(
        project_id=project_id,
        prompt=body.prompt,
        first_frame=body.first_frame,
    )
    svc = GenerationService(db)
    task = svc.get(task_id)
    return ApiResponse(data=GenerationTaskRead.model_validate(task))
