from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.schemas.common import ApiResponse, PaginatedData
from app.schemas.project import ProjectRead, ProjectCreate, ProjectUpdate
from app.services.project_service import ProjectService

router = APIRouter()


@router.post("/projects", response_model=ApiResponse[ProjectRead])
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
):
    svc = ProjectService(db)
    project = svc.create(**body.model_dump())
    return ApiResponse(data=ProjectRead.model_validate(project))


@router.get("/projects", response_model=ApiResponse[PaginatedData[ProjectRead]])
def list_projects(
    db: Session = Depends(get_db),
):
    svc = ProjectService(db)
    items = svc.list_all()
    return ApiResponse(data=PaginatedData(items=[ProjectRead.model_validate(p) for p in items]))


@router.get("/projects/{project_id}", response_model=ApiResponse[ProjectRead])
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
):
    svc = ProjectService(db)
    project = svc.get(project_id)
    if not project:
        from app.core.exceptions import ShopShotException
        raise ShopShotException(404, "Project not found")
    return ApiResponse(data=ProjectRead.model_validate(project))


@router.put("/projects/{project_id}", response_model=ApiResponse[ProjectRead])
def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
):
    svc = ProjectService(db)
    project = svc.update(project_id, **body.model_dump(exclude_unset=True))
    return ApiResponse(data=ProjectRead.model_validate(project))


@router.delete("/projects/{project_id}", response_model=ApiResponse[dict])
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
):
    svc = ProjectService(db)
    svc.delete(project_id)
    return ApiResponse(data={"deleted": True})
