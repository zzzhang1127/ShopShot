from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.common import ApiResponse
from app.schemas.generation import GenerationTaskRead, TaskStatusRead, TaskResultRead
from app.services.generation_service import GenerationService

router = APIRouter()


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
