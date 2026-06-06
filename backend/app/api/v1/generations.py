import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ShopShotException
from app.schemas.common import ApiResponse
from app.schemas.generation import (
    GenerationTaskRead,
    TaskStatusRead,
    TaskResultRead,
    TaskCancelRead,
    TaskPayloadRead,
)
from app.services.generation_service import GenerationService

router = APIRouter()


def _parse_json_field(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {"value": data}
    except json.JSONDecodeError:
        return {"raw": raw}


@router.get("/generations/{task_id}/status", response_model=ApiResponse[TaskStatusRead])
def get_task_status(
    task_id: str,
    db: Session = Depends(get_db),
):
    svc = GenerationService(db)
    task = svc.get(task_id)
    return ApiResponse(data=TaskStatusRead.model_validate(task))


@router.get("/generations/{task_id}/result", response_model=ApiResponse[TaskResultRead])
def get_task_result(
    task_id: str,
    db: Session = Depends(get_db),
):
    svc = GenerationService(db)
    task = svc.get(task_id)
    return ApiResponse(data=TaskResultRead.model_validate(task))


@router.post("/generations/{task_id}/cancel", response_model=ApiResponse[TaskCancelRead])
def cancel_generation_task(task_id: str, db: Session = Depends(get_db)):
    svc = GenerationService(db)
    task = svc.cancel_task(task_id)
    return ApiResponse(data=TaskCancelRead(id=task.id, status=task.status))


@router.get("/generations/project/{project_id}/latest", response_model=ApiResponse[GenerationTaskRead | None])
def get_latest_task_for_project(
    project_id: int,
    db: Session = Depends(get_db),
):
    from sqlalchemy import select
    from app.models import GenerationTask
    
    result = db.execute(
        select(GenerationTask)
        .where(GenerationTask.project_id == project_id)
        .order_by(GenerationTask.created_at.desc())
        .limit(1)
    )
    task = result.scalar_one_or_none()
    if not task:
        return ApiResponse(data=None)
    return ApiResponse(data=GenerationTaskRead.model_validate(task))


@router.get("/generations/{task_id}/payload", response_model=ApiResponse[TaskPayloadRead])
def get_task_payload(task_id: str, db: Session = Depends(get_db)):
    """Pixelle-style duplicate: return saved run parameters for replay."""
    svc = GenerationService(db)
    task = svc.get(task_id)
    if not task:
        raise ShopShotException(404, "Task not found")
    return ApiResponse(
        data=TaskPayloadRead(
            id=task.id,
            project_id=task.project_id,
            type=task.type,
            status=task.status,
            payload=_parse_json_field(task.payload),
            result=_parse_json_field(task.result),
        )
    )
