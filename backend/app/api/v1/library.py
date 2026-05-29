"""Cross-project library endpoints for assets, scripts, and videos."""

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Asset, AssetType, Project, Script, Video
from app.schemas.asset import AssetRead
from app.schemas.common import ApiResponse, PaginatedData
from app.schemas.script import ScriptRead
from app.schemas.video import VideoRead

router = APIRouter()


@router.get("/library/assets", response_model=ApiResponse[PaginatedData[AssetRead]])
def list_library_assets(
    limit: int = 80,
    type: Optional[AssetType] = None,
    source: Optional[str] = None,
    db: Session = Depends(get_db),
):
    limit = min(max(limit, 1), 200)
    query = select(Asset).order_by(Asset.id.desc()).limit(limit)
    if type:
        query = query.where(Asset.type == type)
    if source:
        query = query.where(Asset.source == source)
    items = db.execute(query).scalars().all()
    return ApiResponse(data=PaginatedData(items=[AssetRead.model_validate(a) for a in items]))


@router.get("/library/scripts", response_model=ApiResponse[PaginatedData[ScriptRead]])
def list_library_scripts(
    limit: int = 50,
    db: Session = Depends(get_db),
):
    limit = min(max(limit, 1), 200)
    items = (
        db.execute(select(Script).order_by(Script.id.desc()).limit(limit)).scalars().all()
    )
    return ApiResponse(data=PaginatedData(items=[ScriptRead.model_validate(s) for s in items]))


@router.get("/library/videos", response_model=ApiResponse[PaginatedData[VideoRead]])
def list_library_videos(
    limit: int = 50,
    db: Session = Depends(get_db),
):
    limit = min(max(limit, 1), 200)
    items = (
        db.execute(select(Video).order_by(Video.id.desc()).limit(limit)).scalars().all()
    )
    return ApiResponse(data=PaginatedData(items=[VideoRead.model_validate(v) for v in items]))


@router.get("/library/projects-map", response_model=ApiResponse[dict[int, str]])
def library_projects_map(db: Session = Depends(get_db)):
    """Lightweight id→name map for library UI labels."""
    rows = db.execute(select(Project.id, Project.name)).all()
    return ApiResponse(data={int(r[0]): str(r[1]) for r in rows})
