"""Pixelle-Video capability map exposed for ShopShot frontend."""
from fastapi import APIRouter

from app.config import get_settings
from app.schemas.common import ApiResponse

router = APIRouter()
settings = get_settings()

_PIPELINES = [
    {
        "id": "quick_create",
        "pixelle_key": "standard",
        "name": "一键成片",
        "description": "主题 → 剧本 → Seedance 多分镜 → 合成（对应 Pixelle standard）",
        "media_tab": "video",
        "shopshot_mode": "quick",
        "requires_comfy": False,
        "requires_upload": False,
    },
    {
        "id": "asset_based",
        "pixelle_key": "asset_based",
        "name": "素材驱动",
        "description": "上传商品图/视频，AI 写脚本并映射素材（对应 Pixelle asset_based）",
        "media_tab": "video",
        "shopshot_mode": "advanced",
        "requires_comfy": False,
        "requires_upload": True,
    },
    {
        "id": "digital_human",
        "pixelle_key": "digital_human",
        "name": "数字人口播",
        "description": "ComfyUI 数字人工作流 + 旁白（需 ComfyUI）",
        "media_tab": "video",
        "shopshot_mode": "advanced",
        "requires_comfy": True,
        "requires_upload": False,
    },
    {
        "id": "i2v",
        "pixelle_key": "i2v",
        "name": "图生视频",
        "description": "参考图 + ComfyUI 视频工作流（WAN 等）",
        "media_tab": "video",
        "shopshot_mode": "advanced",
        "requires_comfy": True,
        "requires_upload": True,
    },
    {
        "id": "action_transfer",
        "pixelle_key": "action_transfer",
        "name": "动作迁移",
        "description": "参考视频 + 图片，ComfyUI 动作迁移",
        "media_tab": "video",
        "shopshot_mode": "advanced",
        "requires_comfy": True,
        "requires_upload": True,
    },
]


@router.get("/pixelle/pipelines")
def list_pixelle_pipelines():
    comfy_ok = settings.comfyui_enabled and bool(settings.comfyui_url)
    items = []
    for p in _PIPELINES:
        row = dict(p)
        row["available"] = not p["requires_comfy"] or comfy_ok
        items.append(row)
    return ApiResponse(
        data={
            "pipelines": items,
            "comfyui_enabled": settings.comfyui_enabled,
            "features": {
                "script_llm": bool(settings.volc_api_key and settings.doubao_seed_ep),
                "video_seedance": bool(settings.volc_api_key and settings.doubao_seedance_ep),
                "wan_prompt_enhance": settings.wan_prompt_enhance_enabled,
                "wan_image": settings.wan_image_enabled and bool(settings.dashscope_api_key),
                "wan_video": settings.wan_video_enabled and bool(settings.dashscope_api_key),
                "comfy_workflows": comfy_ok,
                "bgm_library": True,
                "tts": settings.tts_generation_enabled,
                "html_templates": True,
            },
        }
    )
