from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.schemas.common import ApiResponse, PaginatedData
from app.schemas.asset import AssetRead, AssetCreate
from app.services.asset_service import AssetService
from app.models import AssetType

router = APIRouter()


@router.post("/upload", response_model=ApiResponse[AssetRead])
def upload_asset(
    file: UploadFile = File(...),
    project_id: int = 0,
    db: Session = Depends(get_db),
):
    file_bytes = file.file.read()
    svc = AssetService(db)
    asset_type = AssetType.IMAGE if file.content_type and file.content_type.startswith("image") else AssetType.VIDEO
    asset = svc.create(
        project_id=project_id,
        name=file.filename or "untitled",
        type=asset_type,
        file_bytes=file_bytes,
        filename=file.filename or "untitled",
    )
    return ApiResponse(data=AssetRead.model_validate(asset))


@router.get("/assets", response_model=ApiResponse[PaginatedData[AssetRead]])
def list_assets(
    project_id: int,
    type: Optional[AssetType] = None,
    db: Session = Depends(get_db),
):
    svc = AssetService(db)
    items = svc.list_by_project(project_id, type)
    return ApiResponse(data=PaginatedData(items=[AssetRead.model_validate(a) for a in items]))
