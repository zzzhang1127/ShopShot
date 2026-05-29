import json
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ShopShotException
from app.models import AssetType
from app.config import get_settings
from app.schemas.comfy import (
    ComfyExecuteRead,
    ComfyExecuteRequest,
    ComfyExecutePresetRequest,
    ComfyHealthRead,
    ComfyWorkflowItem,
)
from app.schemas.common import ApiResponse
from app.services.asset_service import AssetService
from app.utils.comfyui_client import ComfyUIError, get_comfyui_client
from app.utils.comfy_workflow_params import inject_workflow_params, workflow_category

router = APIRouter()
settings = get_settings()


def _workflows_root() -> Path:
    root = Path(settings.comfyui_workflows_dir)
    if not root.is_absolute():
        root = (Path(__file__).resolve().parents[4] / root).resolve()
    return root


def _asset_type_from_kind(kind: str) -> AssetType:
    if kind == "image":
        return AssetType.IMAGE
    if kind == "audio":
        return AssetType.AUDIO
    return AssetType.VIDEO


def _filename_with_fallback(filename: str | None, kind: str) -> str:
    if filename:
        return filename
    ext = {"image": ".png", "audio": ".mp3", "video": ".mp4"}.get(kind, ".bin")
    return f"comfy_output{ext}"


def _resolve_workflow_path(path: str) -> Path:
    root = _workflows_root()
    rel = path.replace("\\", "/").lstrip("/")
    target = (root / rel).resolve()
    if not str(target).startswith(str(root.resolve())):
        raise ShopShotException(400, "Invalid workflow path")
    if not target.is_file():
        raise ShopShotException(404, "Workflow file not found")
    return target


def _load_workflow_dict(path: str) -> dict:
    target = _resolve_workflow_path(path)
    with open(target, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ShopShotException(400, "Workflow JSON must be an object")
    return data


@router.get("/comfy/health", response_model=ApiResponse[ComfyHealthRead])
def comfy_health():
    client = get_comfyui_client()
    reachable, message = client.health()
    editor_url = (settings.comfyui_url or "").rstrip("/") if settings.comfyui_enabled else ""
    return ApiResponse(
        data=ComfyHealthRead(
            enabled=client.enabled,
            configured=client.configured,
            reachable=reachable,
            message=message,
            editor_url=editor_url,
        )
    )


@router.post("/comfy/execute-preset", response_model=ApiResponse[ComfyExecuteRead])
def execute_comfy_preset(body: ComfyExecutePresetRequest, db: Session = Depends(get_db)):
    """One-click: load preset workflow from disk, inject prompt/seed, then execute."""
    raw = _load_workflow_dict(body.workflow_path)
    workflow = inject_workflow_params(raw, prompt=body.prompt, seed=body.seed)
    output_kind = body.output_kind
    if output_kind == "auto":
        cat = workflow_category(body.workflow_path)
        if cat in ("image", "video", "audio"):
            output_kind = cat  # type: ignore[assignment]
    req = ComfyExecuteRequest(
        project_id=body.project_id,
        workflow=workflow,
        output_kind=output_kind,
        source=body.source,
    )
    return execute_comfy_workflow(req, db)


@router.post("/comfy/execute", response_model=ApiResponse[ComfyExecuteRead])
def execute_comfy_workflow(body: ComfyExecuteRequest, db: Session = Depends(get_db)):
    client = get_comfyui_client()
    try:
        prompt_id, bytes_data, output_name, output_kind = client.execute(body.workflow)
    except ComfyUIError as exc:
        raise ShopShotException(400, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise ShopShotException(500, f"ComfyUI 执行异常: {exc}") from exc

    # 若前端指定 output_kind，做一致性校验（auto 则跳过）
    if body.output_kind != "auto" and output_kind != body.output_kind:
        raise ShopShotException(
            400,
            f"ComfyUI 输出类型为 {output_kind}，与请求的 {body.output_kind} 不一致",
        )

    kind = output_kind if body.output_kind == "auto" else body.output_kind
    filename = _filename_with_fallback(body.filename or output_name, kind)
    suffix = Path(filename).suffix
    if not suffix:
        filename = f"{filename}{'.png' if kind == 'image' else '.mp3' if kind == 'audio' else '.mp4'}"

    asset = AssetService(db).create(
        project_id=body.project_id,
        name=Path(filename).name,
        type=_asset_type_from_kind(kind),
        file_bytes=bytes_data,
        filename=filename,
        source=body.source or "comfy_generated",
    )
    return ApiResponse(
        data=ComfyExecuteRead(
            prompt_id=prompt_id,
            asset_id=int(asset.id or 0),
            asset_type=asset.type.value if hasattr(asset.type, "value") else str(asset.type),
            asset_url=asset.url,
            source=asset.source or "",
        )
    )


@router.get("/comfy/workflows", response_model=ApiResponse[list[ComfyWorkflowItem]])
def list_comfy_workflows():
    root = _workflows_root()
    if not root.exists():
        return ApiResponse(data=[])
    files = sorted([p for p in root.rglob("*.json") if p.is_file()])
    items = []
    for p in files:
        rel = str(p.relative_to(root)).replace("\\", "/")
        cat = workflow_category(rel)
        items.append(
            ComfyWorkflowItem(
                name=p.stem,
                path=rel,
                category=cat,  # type: ignore[arg-type]
                display_name=f"{p.stem} ({cat})" if cat != "unknown" else p.stem,
            )
        )
    return ApiResponse(data=items)


@router.get("/comfy/workflows/content", response_model=ApiResponse[dict])
def get_comfy_workflow_content(path: str = Query(..., min_length=1)):
    """Load workflow JSON from disk (Pixelle-style preset fill)."""
    return ApiResponse(data=_load_workflow_dict(path))
