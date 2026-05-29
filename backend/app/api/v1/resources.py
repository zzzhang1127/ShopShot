from pathlib import Path

from fastapi import APIRouter

from app.config import get_settings
from app.schemas.common import ApiResponse
from app.schemas.resources import ResourceItem, ModelCapabilityRead

router = APIRouter()
settings = get_settings()


def _project_root() -> Path:
    return Path(__file__).resolve().parents[4]


@router.get("/resources/workflows", response_model=ApiResponse[list[ResourceItem]])
def list_workflow_resources():
    root = Path(settings.comfyui_workflows_dir)
    if not root.is_absolute():
        root = (_project_root() / root).resolve()
    if not root.exists():
        return ApiResponse(data=[])

    items: list[ResourceItem] = []
    for p in sorted(root.rglob("*.json")):
        if not p.is_file():
            continue
        rel = str(p.relative_to(root)).replace("\\", "/")
        items.append(
            ResourceItem(
                id=f"workflow:{rel}",
                kind="workflow",
                name=p.stem,
                path=rel,
                url=f"/api/v1/comfy/workflows/content?path={rel}",
                source="comfyui",
            )
        )
    return ApiResponse(data=items)


@router.get("/resources/templates", response_model=ApiResponse[list[ResourceItem]])
def list_template_resources():
    root = _project_root() / "frontend" / "public" / "templates"
    if not root.exists():
        return ApiResponse(data=[])

    items: list[ResourceItem] = []
    exts = {".jpg", ".jpeg", ".png", ".webp", ".mp4"}
    for p in sorted(root.iterdir()):
        if not p.is_file() or p.suffix.lower() not in exts:
            continue
        rel = f"templates/{p.name}"
        kind = "template_video" if p.suffix.lower() == ".mp4" else "template_cover"
        items.append(
            ResourceItem(
                id=f"template:{p.name}",
                kind=kind,
                name=p.stem,
                path=rel,
                url=f"/{rel}",
                source="official",
            )
        )
    return ApiResponse(data=items)


@router.get("/resources/bgm", response_model=ApiResponse[list[ResourceItem]])
def list_bgm_resources():
    roots = [
        _project_root() / "backend" / "bgm",
        _project_root() / "bgm",
    ]
    exts = {".mp3", ".wav", ".m4a", ".aac", ".ogg"}

    items: list[ResourceItem] = []
    for root in roots:
        if not root.exists():
            continue
        for p in sorted(root.rglob("*")):
            if not p.is_file() or p.suffix.lower() not in exts:
                continue
            rel = str(p.relative_to(root)).replace("\\", "/")
            items.append(
                ResourceItem(
                    id=f"bgm:{root.name}:{rel}",
                    kind="bgm",
                    name=p.stem,
                    path=rel,
                    url=f"/api/v1/import-bgm?project_id=0&path={rel}&source_root={root.name}",
                    source=root.name,
                )
            )
    return ApiResponse(data=items)


@router.get("/resources/models", response_model=ApiResponse[list[ModelCapabilityRead]])
def list_model_capabilities():
    items = [
        ModelCapabilityRead(
            id="seed-script",
            name="Seed-2.0-pro (剧本)",
            role="script",
            configured=bool(settings.volc_api_key and settings.doubao_seed_ep),
            endpoint_hint=settings.doubao_seed_ep or "",
            notes="AIDA 四镜分镜剧本",
        ),
        ModelCapabilityRead(
            id="seedance-video",
            name="Seedance-1.5-pro (视频)",
            role="video",
            configured=bool(settings.volc_api_key and settings.doubao_seedance_ep),
            endpoint_hint=settings.doubao_seedance_ep or "",
            notes="多分镜视频生成与拼接",
        ),
        ModelCapabilityRead(
            id="wan-prompt",
            name="Wan 电影级提示词增强",
            role="prompt",
            configured=settings.wan_prompt_enhance_enabled and bool(settings.volc_api_key),
            endpoint_hint="Wan2.2 prompt_extend + Seed",
            notes="分镜画面/运镜自动扩写",
        ),
        ModelCapabilityRead(
            id="wan-image",
            name="Wan2.7 生图",
            role="image",
            configured=settings.wan_image_enabled and bool(settings.dashscope_api_key),
            endpoint_hint=settings.wan_image_model,
            notes="无参考图时自动生成分镜参考图（Wan-skills）",
        ),
        ModelCapabilityRead(
            id="wan-video",
            name="Wan 图生视频",
            role="video",
            configured=settings.wan_video_enabled and bool(settings.dashscope_api_key),
            endpoint_hint=settings.wan_video_model,
            notes="Seedance 失败时的可选回退",
        ),
        ModelCapabilityRead(
            id="comfyui",
            name="ComfyUI (可选)",
            role="image_audio",
            configured=settings.comfyui_enabled and bool(settings.comfyui_url),
            endpoint_hint=settings.comfyui_url or "",
            notes="生图/语音/实验工作流",
        ),
        ModelCapabilityRead(
            id="tts",
            name="TTS (可选)",
            role="audio",
            configured=settings.tts_generation_enabled,
            endpoint_hint="",
            notes="未开启时不影响主链路",
        ),
    ]
    return ApiResponse(data=items)
