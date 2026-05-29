from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ScriptCreate(BaseModel):
    project_id: int
    video_type: Optional[str] = None


class ScriptRead(BaseModel):
    id: int
    project_id: Optional[int] = None
    video_type: Optional[str] = None
    title: Optional[str] = None
    tags: Optional[str] = None
    strategy: Optional[str] = None
    factors: Optional[str] = None
    raw_config: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScriptUpdate(BaseModel):
    video_type: Optional[str] = None
    title: Optional[str] = None
    tags: Optional[str] = None
    strategy: Optional[str] = None
    factors: Optional[str] = None
    raw_config: Optional[str] = None
    status: Optional[str] = None


class ScriptGenerateRequest(BaseModel):
    project_id: int
    mode: str = "auto"  # template / viral / auto
    product_info: Optional[str] = None
