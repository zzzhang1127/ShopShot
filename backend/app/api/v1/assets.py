from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.exceptions import ShopShotException
from app.schemas.common import ApiResponse, PaginatedData
from app.schemas.asset import AssetRead, AssetCreate
from app.services.asset_service import AssetService
from app.models import AssetType

router = APIRouter()

_BGM_ROOTS = (
    Path(__file__).resolve().parents[4] / "bgm",
    Path(__file__).resolve().parents[3] / "bgm",
)


@router.post("/upload", response_model=ApiResponse[AssetRead])
def upload_asset(
    file: UploadFile = File(...),
    project_id: int = 0,
    source: str = "upload",
    db: Session = Depends(get_db),
):
    file_bytes = file.file.read()
    svc = AssetService(db)
    ct = (file.content_type or "").lower()
    if ct.startswith("image"):
        asset_type = AssetType.IMAGE
    elif ct.startswith("audio"):
        asset_type = AssetType.AUDIO
    else:
        asset_type = AssetType.VIDEO
    asset = svc.create(
        project_id=project_id,
        name=file.filename or "untitled",
        type=asset_type,
        file_bytes=file_bytes,
        filename=file.filename or "untitled",
        source=source,
    )
    return ApiResponse(data=AssetRead.model_validate(asset))


@router.post("/import-bgm", response_model=ApiResponse[AssetRead])
def import_bgm_from_library(
    project_id: int = Query(..., ge=1),
    path: str = Query(..., min_length=1),
    source_root: str = Query("bgm", description="Root folder name under project (bgm)"),
    db: Session = Depends(get_db),
):
    """Import a file from built-in BGM library into project assets (source=bgm)."""
    rel = path.replace("\\", "/").lstrip("/")
    chosen: Path | None = None
    for root in _BGM_ROOTS:
        if not root.exists():
            continue
        if source_root and root.name != source_root:
            continue
        candidate = (root / rel).resolve()
        if candidate.is_file() and str(candidate).startswith(str(root.resolve())):
            chosen = candidate
            break
    if not chosen:
        for root in _BGM_ROOTS:
            if not root.exists():
                continue
            candidate = (root / rel).resolve()
            if candidate.is_file() and str(candidate).startswith(str(root.resolve())):
                chosen = candidate
                break
    if not chosen:
        raise ShopShotException(404, "BGM file not found in library")

    data = chosen.read_bytes()
    svc = AssetService(db)
    asset = svc.create(
        project_id=project_id,
        name=chosen.name,
        type=AssetType.AUDIO,
        file_bytes=data,
        filename=chosen.name,
        source="bgm",
    )
    return ApiResponse(data=AssetRead.model_validate(asset))


@router.get("/assets", response_model=ApiResponse[PaginatedData[AssetRead]])
def list_assets(
    project_id: int,
    type: Optional[AssetType] = None,
    source: Optional[str] = None,
    db: Session = Depends(get_db),
):
    svc = AssetService(db)
    items = svc.list_by_project(project_id, type, source)
    return ApiResponse(data=PaginatedData(items=[AssetRead.model_validate(a) for a in items]))
