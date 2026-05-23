from pydantic import BaseModel
from typing import Optional
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
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class TaskStatusRead(BaseModel):
    id: str
    status: TaskStatus
    progress: int
    agent_name: Optional[str] = None
    step: Optional[str] = None


class TaskResultRead(BaseModel):
    id: str
    status: TaskStatus
    result: Optional[str] = None
    error: Optional[str] = None


class TaskCancelRead(BaseModel):
    id: str
    status: TaskStatus


class AgentRunRequest(BaseModel):
    project_id: int
    workflow: str = "full"  # full / script / video / postprocess
    target_ratio: Optional[str] = None
    target_resolution: Optional[str] = None
    duration: Optional[int] = None


class QuickGenerateRequest(BaseModel):
    project_id: int
    prompt: str
    first_frame: Optional[str] = None
    target_ratio: Optional[str] = None
    target_resolution: Optional[str] = None
