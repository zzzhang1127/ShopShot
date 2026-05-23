from pydantic import BaseModel
from typing import Optional
from app.models import VideoRatio, VideoResolution, VideoStatus


class VideoCreate(BaseModel):
    project_id: int
    ratio: Optional[VideoRatio] = None
    resolution: Optional[VideoResolution] = None


class VideoRead(BaseModel):
    id: int
    project_id: Optional[int] = None
    task_id: Optional[str] = None
    url: str
    thumbnail_url: Optional[str] = None
    ratio: Optional[VideoRatio] = None
    resolution: Optional[VideoResolution] = None
    duration: Optional[int] = None
    file_size: Optional[int] = None
    status: VideoStatus
    factors: Optional[str] = None

    class Config:
        from_attributes = True


class ExportRequest(BaseModel):
    ratio: VideoRatio
    resolution: VideoResolution


class PublishRequest(BaseModel):
    platform: str = "douyin"
