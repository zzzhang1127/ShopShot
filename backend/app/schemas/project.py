from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models import ProjectStatus


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    product_url: Optional[str] = None
    product_info: Optional[str] = None
    video_mode: Optional[str] = "product_show"
    target_platform: Optional[str] = "douyin"
    target_ratio: Optional[str] = "9:16"
    target_resolution: Optional[str] = "720p"
    target_audience: Optional[str] = None
    language: Optional[str] = "zh"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    product_url: Optional[str] = None
    product_info: Optional[str] = None
    video_mode: Optional[str] = None
    target_platform: Optional[str] = None
    target_ratio: Optional[str] = None
    target_resolution: Optional[str] = None
    target_audience: Optional[str] = None
    language: Optional[str] = None
    status: Optional[ProjectStatus] = None


class ProjectRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    product_url: Optional[str] = None
    product_info: Optional[str] = None
    video_mode: Optional[str] = None
    target_platform: Optional[str] = None
    target_ratio: Optional[str] = None
    target_resolution: Optional[str] = None
    target_audience: Optional[str] = None
    language: Optional[str] = None
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
