"""将本地素材路径转为 Seedance 可用的 image_url（data URI）。"""
import base64
import mimetypes
from pathlib import Path

from app.core.storage import get_file_path


def local_asset_to_image_url(relative_path: str | None) -> str | None:
    if not relative_path:
        return None
    path = get_file_path(relative_path)
    if not path.is_file():
        return None
    mime, _ = mimetypes.guess_type(path.name)
    if not mime or not mime.startswith("image/"):
        mime = "image/jpeg"
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"
