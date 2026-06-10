from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.exceptions import ShopShotException
from app.schemas.common import ApiResponse, PaginatedData
from app.schemas.asset import AssetRead, AssetCreate, DownloadUrlRequest
from app.services.asset_service import AssetService
from app.models import AssetType

router = APIRouter()

_BGM_ROOTS = (
    Path(__file__).resolve().parents[4] / "bgm",
    Path(__file__).resolve().parents[3] / "bgm",
)


@router.post("/upload", response_model=ApiResponse[AssetRead])
def upload_asset(
    file: UploadFile = File(...),
    project_id: int = 0,
    source: str = "upload",
    db: Session = Depends(get_db),
):
    file_bytes = file.file.read()
    svc = AssetService(db)
    ct = (file.content_type or "").lower()
    if ct.startswith("image"):
        asset_type = AssetType.IMAGE
    elif ct.startswith("audio"):
        asset_type = AssetType.AUDIO
    else:
        asset_type = AssetType.VIDEO
    asset = svc.create(
        project_id=project_id,
        name=file.filename or "untitled",
        type=asset_type,
        file_bytes=file_bytes,
        filename=file.filename or "untitled",
        source=source,
    )
    return ApiResponse(data=AssetRead.model_validate(asset))


@router.post("/assets/download-url", response_model=ApiResponse[AssetRead])
def download_url_asset(
    body: DownloadUrlRequest,
    db: Session = Depends(get_db),
):
    """Download an image from a URL and store as project asset."""
    import httpx
    url = body.url.strip()
    parsed = url.split("?")[0]
    filename = parsed.split("/")[-1] or "image.jpg"
    if not filename or "." not in filename:
        filename = "image.jpg"

    try:
        with httpx.Client(timeout=30, follow_redirects=True) as client:
            r = client.get(url)
            r.raise_for_status()
    except Exception as e:
        raise ShopShotException(400, f"图片下载失败: {e}")

    content_type = r.headers.get("content-type", "image/jpeg").lower()
    if not content_type.startswith("image"):
        raise ShopShotException(400, "URL 不指向有效图片")

    svc = AssetService(db)
    asset = svc.create(
        project_id=body.project_id,
        name=filename,
        type=AssetType.IMAGE,
        file_bytes=r.content,
        filename=filename,
        source="url_import",
    )
    return ApiResponse(data=AssetRead.model_validate(asset))


@router.post("/assets/extract-camera-style", response_model=ApiResponse[dict])
def extract_camera_style(
    file: UploadFile = File(...),
    project_id: int = 0,
    db: Session = Depends(get_db),
):
    """Upload a shot template video and generate a camera style description."""
    file_bytes = file.file.read()
    svc = AssetService(db)
    asset = svc.create(
        project_id=project_id,
        name=file.filename or "template.mp4",
        type=AssetType.VIDEO,
        file_bytes=file_bytes,
        filename=file.filename or "template.mp4",
        source="shot_template",
    )

    filename = file.filename or "template.mp4"
    camera_style = _guess_camera_style(filename)

    try:
        from app.utils.seed_client import get_seed_client
        seed = get_seed_client()
        camera_style = seed.chat(
            [
                {
                    "role": "system",
                    "content": (
                        "You are a video director expert. Based on a template video filename, "
                        "generate a concise camera movement style description in English for "
                        "Seedance AI video generation. Output 1 short sentence only, "
                        "e.g. 'slow push-in, product centered, close-up shot'."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Template video filename: {filename}\n"
                        "Generate a camera movement style description (English, 1 sentence, "
                        "use terms like: push in, pull out, pan, orbit, crane up, crane down, "
                        "close-up, wide shot, medium shot, slow motion)."
                    ),
                },
            ],
            temperature=0.6,
            max_tokens=80,
        )
        camera_style = camera_style.strip().strip('"').strip("'")
    except Exception:
        pass

    return ApiResponse(
        data={
            "asset_id": asset.id,
            "asset_url": asset.url,
            "camera_style": camera_style,
            "filename": filename,
        }
    )


def _guess_camera_style(filename: str) -> str:
    name = filename.lower()
    if "push" in name or "dolly" in name:
        return "slow push-in, product centered, cinematic"
    if "pull" in name or "out" in name:
        return "slow pull-out, wide product reveal"
    if "orbit" in name or "rotate" in name or "spin" in name:
        return "orbit around product, 360 degree, medium shot"
    if "close" in name or "macro" in name:
        return "extreme close-up, product detail, static"
    if "pan" in name:
        return "horizontal pan, product tracking, medium shot"
    return "slow push-in, product centered, close-up, cinematic lighting"


@router.post("/import-bgm", response_model=ApiResponse[AssetRead])
def import_bgm_from_library(
    project_id: int = Query(..., ge=1),
    path: str = Query(..., min_length=1),
    source_root: str = Query("bgm", description="Root folder name under project (bgm)"),
    db: Session = Depends(get_db),
):
    """Import a file from built-in BGM library into project assets (source=bgm)."""
    rel = path.replace("\\", "/").lstrip("/")
    chosen: Path | None = None
    for root in _BGM_ROOTS:
        if not root.exists():
            continue
        if source_root and root.name != source_root:
            continue
        candidate = (root / rel).resolve()
        if candidate.is_file() and str(candidate).startswith(str(root.resolve())):
            chosen = candidate
            break
    if not chosen:
        for root in _BGM_ROOTS:
            if not root.exists():
                continue
            candidate = (root / rel).resolve()
            if candidate.is_file() and str(candidate).startswith(str(root.resolve())):
                chosen = candidate
                break
    if not chosen:
        raise ShopShotException(404, "BGM file not found in library")

    data = chosen.read_bytes()
    svc = AssetService(db)
    asset = svc.create(
        project_id=project_id,
        name=chosen.name,
        type=AssetType.AUDIO,
        file_bytes=data,
        filename=chosen.name,
        source="bgm",
    )
    return ApiResponse(data=AssetRead.model_validate(asset))


@router.get("/assets", response_model=ApiResponse[PaginatedData[AssetRead]])
def list_assets(
    project_id: int,
    type: Optional[AssetType] = None,
    source: Optional[str] = None,
    db: Session = Depends(get_db),
):
    svc = AssetService(db)
    items = svc.list_by_project(project_id, type, source)
    return ApiResponse(data=PaginatedData(items=[AssetRead.model_validate(a) for a in items]))


@router.delete("/assets/{asset_id}", response_model=ApiResponse[dict])
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
):
    svc = AssetService(db)
    svc.delete(asset_id)
    return ApiResponse(data={"deleted": True, "asset_id": asset_id})


# ── BGM endpoints ──────────────────────────────────────────────────────────────

# Static preset BGM tracks (place matching .mp3 files in backend/static/bgm/)
_BGM_PRESETS = [
    {
        "id": "bgm_energetic",
        "label": "活力节拍",
        "mood": "energetic",
        "description": "快节奏电商展示，适合运动/时尚品类",
        "filename": "bgm_energetic.mp3",
        "duration": 30,
    },
    {
        "id": "bgm_calm",
        "label": "轻柔简约",
        "mood": "calm",
        "description": "温柔舒缓，适合家居/美妆/食品品类",
        "filename": "bgm_calm.mp3",
        "duration": 30,
    },
    {
        "id": "bgm_corporate",
        "label": "商务大气",
        "mood": "corporate",
        "description": "沉稳专业，适合数码/奢侈品品类",
        "filename": "bgm_corporate.mp3",
        "duration": 30,
    },
    {
        "id": "bgm_trendy",
        "label": "潮流时尚",
        "mood": "trendy",
        "description": "流行节拍，适合服装/潮玩/美妆品类",
        "filename": "bgm_trendy.mp3",
        "duration": 30,
    },
]

_STATIC_BGM_DIR = Path(__file__).resolve().parents[3] / "static" / "bgm"


@router.get("/assets/bgm-presets", response_model=ApiResponse[list])
def list_bgm_presets():
    """Return available preset BGM tracks.

    Tracks are available if the corresponding .mp3 file exists under
    backend/static/bgm/.  The ``available`` flag lets the frontend grey out
    missing tracks while still showing the full catalogue.
    """
    result = []
    for preset in _BGM_PRESETS:
        file_path = _STATIC_BGM_DIR / preset["filename"]
        result.append(
            {
                **preset,
                "available": file_path.is_file(),
                "url": f"/static/bgm/{preset['filename']}" if file_path.is_file() else None,
            }
        )
    return ApiResponse(data=result)


@router.post("/assets/bgm-upload", response_model=ApiResponse[AssetRead])
def upload_bgm(
    file: UploadFile = File(...),
    project_id: int = 0,
    db: Session = Depends(get_db),
):
    """Upload a custom BGM audio file for a project.

    The uploaded file is stored as an Asset with ``source='bgm'``.
    PostProcessAgent automatically picks the latest BGM asset and mixes it
    into the final video.
    """
    ct = (file.content_type or "").lower()
    if not ct.startswith("audio"):
        raise ShopShotException(400, "只支持音频文件（mp3、wav、aac 等）")

    file_bytes = file.file.read()
    svc = AssetService(db)
    asset = svc.create(
        project_id=project_id,
        name=file.filename or "bgm.mp3",
        type=AssetType.AUDIO,
        file_bytes=file_bytes,
        filename=file.filename or "bgm.mp3",
        source="bgm",
    )
    return ApiResponse(data=AssetRead.model_validate(asset))


@router.post("/assets/bgm-from-preset", response_model=ApiResponse[AssetRead])
def apply_bgm_preset(
    preset_id: str,
    project_id: int,
    db: Session = Depends(get_db),
):
    """Copy a preset BGM into the project as an asset so PostProcessAgent can use it."""
    preset = next((p for p in _BGM_PRESETS if p["id"] == preset_id), None)
    if not preset:
        raise ShopShotException(404, f"Preset '{preset_id}' not found")

    file_path = _STATIC_BGM_DIR / preset["filename"]
    if not file_path.is_file():
        raise ShopShotException(
            404,
            f"BGM file '{preset['filename']}' not found on server. "
            "Please place the file in backend/static/bgm/ and restart.",
        )

    data = file_path.read_bytes()
    svc = AssetService(db)
    asset = svc.create(
        project_id=project_id,
        name=preset["filename"],
        type=AssetType.AUDIO,
        file_bytes=data,
        filename=preset["filename"],
        source="bgm",
    )
    return ApiResponse(data=AssetRead.model_validate(asset))

