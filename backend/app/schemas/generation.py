from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models import TaskStatus, TaskType


class GenerationTaskRead(BaseModel):
    id: str
    project_id: Optional[int] = None
    type: TaskType
    status: TaskStatus
    progress: int
    retry_count: int
    agent_name: Optional[str] = None
    step: Optional[str] = None
    error: Optional[str] = None
    result: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskStatusRead(BaseModel):
    id: str
    type: TaskType
    status: TaskStatus
    progress: int
    agent_name: Optional[str] = None
    step: Optional[str] = None
    error: Optional[str] = None
    result: Optional[str] = None
    created_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskResultRead(BaseModel):
    id: str
    status: TaskStatus
    result: Optional[str] = None
    error: Optional[str] = None

    class Config:
        from_attributes = True


class TaskCancelRead(BaseModel):
    id: str
    status: TaskStatus

    class Config:
        from_attributes = True


class TaskPayloadRead(BaseModel):
    id: str
    project_id: Optional[int] = None
    type: TaskType
    status: TaskStatus
    payload: Optional[dict] = None
    result: Optional[dict] = None


class PromptEnhanceRequest(BaseModel):
    text: str
    mode: str = "i2v"
    product_context: str = ""


class PromptEnhanceRead(BaseModel):
    original: str
    enhanced: str
    mode: str


class AgentCapabilitiesRead(BaseModel):
    wan_prompt_enhance: bool
    wan_image: bool
    wan_video: bool
    seedance: bool
    comfyui: bool


class AgentRunRequest(BaseModel):
    project_id: int
    workflow: str = "full"  # full / script / video / postprocess
    pipeline_preset: Optional[str] = None
    target_ratio: Optional[str] = None
    target_resolution: Optional[str] = None
    duration: Optional[int] = None


class QuickGenerateRequest(BaseModel):
    project_id: int
    prompt: str
    first_frame: Optional[str] = None
    pipeline_preset: Optional[str] = None
    target_ratio: Optional[str] = None
    target_resolution: Optional[str] = None
    duration: Optional[int] = 20


class VideoGenerateRequest(BaseModel):
    script_id: Optional[int] = None
    pipeline_preset: Optional[str] = None
    target_ratio: Optional[str] = None
    target_resolution: Optional[str] = None
    duration: Optional[int] = 20


class ShotDataItem(BaseModel):
    shot_id: str
    image_prompt: str = ""
    action_prompt: str = ""
    words: str = ""


class VideoFromShotsRequest(BaseModel):
    project_id: int
    shots: list[ShotDataItem]
    product_asset_ids: list[int] = []
    duration: int = 20
    aspect_ratio: str = "9:16"
    enable_tts: bool = False
    tts_voice: str = "zh-CN-XiaoxiaoNeural"
