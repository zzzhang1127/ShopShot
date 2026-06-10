from pydantic import BaseModel
from typing import Optional, List
from app.models import ShotType, ShotStatus


class ShotCreate(BaseModel):
    script_id: int
    project_id: int
    shot_id: str
    type: Optional[ShotType] = None
    image_prompt: Optional[str] = None
    action_prompt: Optional[str] = None
    reference_asset_id: Optional[int] = None
    words: Optional[str] = None
    duration: int = 5
    sequence: int = 0


class ShotRead(BaseModel):
    id: int
    script_id: Optional[int] = None
    project_id: Optional[int] = None
    shot_id: str
    type: Optional[ShotType] = None
    status: ShotStatus
    image_prompt: Optional[str] = None
    action_prompt: Optional[str] = None
    reference_asset_id: Optional[int] = None
    last_frame_asset_id: Optional[int] = None
    generated_image_asset_id: Optional[int] = None
    generated_video_asset_id: Optional[int] = None
    tts_audio_asset_id: Optional[int] = None
    words: Optional[str] = None
    duration: int
    sequence: int
    variant_index: Optional[int] = None

    class Config:
        from_attributes = True


class ShotUpdate(BaseModel):
    type: Optional[ShotType] = None
    image_prompt: Optional[str] = None
    action_prompt: Optional[str] = None
    reference_asset_id: Optional[int] = None
    last_frame_asset_id: Optional[int] = None
    words: Optional[str] = None
    duration: Optional[int] = None
    sequence: Optional[int] = None


class ShotGenerateRequest(BaseModel):
    force: bool = False


class VariantSelectRequest(BaseModel):
    generated_video_asset_id: int
    variant_index: int


class ShotPromptsRequest(BaseModel):
    script_text: str
    camera_styles: List[str] = []
    shot_count: int = 4
    product_info: str = ""
