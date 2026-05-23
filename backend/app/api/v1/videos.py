from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.schemas.common import ApiResponse
from app.schemas.video import VideoRead, ExportRequest
from app.services.video_service import VideoService

router = APIRouter()


@router.get("/videos", response_model=ApiResponse[List[VideoRead]])
def list_videos(
    project_id: int,
    db: Session = Depends(get_db),
):
    svc = VideoService(db)
    items = svc.list_by_project(project_id)
    return ApiResponse(data=[VideoRead.model_validate(v) for v in items])


@router.get("/videos/{video_id}", response_model=ApiResponse[VideoRead])
def get_video(
    video_id: int,
    db: Session = Depends(get_db),
):
    svc = VideoService(db)
    video = svc.get(video_id)
    return ApiResponse(data=VideoRead.model_validate(video))
