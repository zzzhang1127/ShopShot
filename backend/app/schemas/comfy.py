from typing import Any, Literal

from pydantic import BaseModel, Field


class ComfyHealthRead(BaseModel):
    enabled: bool
    configured: bool
    reachable: bool
    message: str
    editor_url: str = ""


class ComfyExecutePresetRequest(BaseModel):
    project_id: int = Field(..., ge=1)
    workflow_path: str = Field(..., min_length=1)
    prompt: str = ""
    seed: int | None = None
    output_kind: Literal["auto", "image", "audio", "video"] = "auto"
    source: str = "comfy_generated"


class ComfyExecuteRequest(BaseModel):
    project_id: int = Field(..., ge=1)
    workflow: dict[str, Any]
    output_kind: Literal["auto", "image", "audio", "video"] = "auto"
    filename: str | None = None
    source: str = "comfy_generated"


class ComfyExecuteRead(BaseModel):
    prompt_id: str
    asset_id: int
    asset_type: str
    asset_url: str
    source: str


class ComfyWorkflowItem(BaseModel):
    name: str
    path: str
    category: Literal["image", "video", "audio", "unknown"] = "unknown"
    display_name: str = ""
