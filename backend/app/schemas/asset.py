from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models import AssetType


class DownloadUrlRequest(BaseModel):
    project_id: int
    url: str


class AssetCreate(BaseModel):
    name: str
    type: AssetType
    project_id: int


class AssetRead(BaseModel):
    id: int
    name: str
    type: AssetType
    url: str
    mime_type: Optional[str] = None
    size: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    meta_data: Optional[str] = None
    analysis: Optional[str] = None
    source: Optional[str] = None
    project_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    analysis: Optional[str] = None
