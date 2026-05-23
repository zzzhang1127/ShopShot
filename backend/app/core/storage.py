import os
import shutil
import uuid
from pathlib import Path
from app.config import get_settings

settings = get_settings()

STORAGE_ROOT = Path(settings.storage_local_path).resolve()


def ensure_dirs():
    for sub in ["assets", "videos", "temp", "thumbnails"]:
        (STORAGE_ROOT / sub).mkdir(parents=True, exist_ok=True)


def save_upload(file_bytes: bytes, filename: str, subdir: str = "assets") -> str:
    ensure_dirs()
    ext = Path(filename).suffix
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest_dir = STORAGE_ROOT / subdir
    dest_path = dest_dir / unique_name
    with open(dest_path, "wb") as f:
        f.write(file_bytes)
    return f"{subdir}/{unique_name}"


def get_file_path(relative_path: str) -> Path:
    return STORAGE_ROOT / relative_path


def delete_file(relative_path: str):
    path = get_file_path(relative_path)
    if path.exists():
        path.unlink()
