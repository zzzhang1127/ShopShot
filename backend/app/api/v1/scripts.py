from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.common import ApiResponse
from app.schemas.script import ScriptRead, ScriptUpdate, ScriptGenerateRequest
from app.schemas.generation import GenerationTaskRead
from app.services.script_service import ScriptService
from app.services.generation_service import GenerationService
from app.agents.director import DirectorAgent
from app.workers.background_jobs import job_execute_script

router = APIRouter()


@router.post("/scripts/generate", response_model=ApiResponse[GenerationTaskRead])
def generate_script(
    body: ScriptGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    agent = DirectorAgent(db)
    task_id = agent.start_script_only(body.project_id)
    background_tasks.add_task(job_execute_script, task_id, body.project_id)
    svc = GenerationService(db)
    task = svc.get(task_id)
    return ApiResponse(data=GenerationTaskRead.model_validate(task))


@router.get("/scripts", response_model=ApiResponse[list[ScriptRead]])
def list_scripts(
    project_id: int,
    db: Session = Depends(get_db),
):
    svc = ScriptService(db)
    items = svc.list_by_project(project_id)
    return ApiResponse(data=[ScriptRead.model_validate(s) for s in items])


@router.put("/scripts/{script_id}", response_model=ApiResponse[ScriptRead])
def update_script(
    script_id: int,
    body: ScriptUpdate,
    db: Session = Depends(get_db),
):
    svc = ScriptService(db)
    script = svc.update(script_id, **body.model_dump(exclude_unset=True))
    return ApiResponse(data=ScriptRead.model_validate(script))
