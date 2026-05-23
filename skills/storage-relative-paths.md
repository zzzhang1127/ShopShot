---
name: storage-relative-paths
description: FastAPI StaticFiles serves from a directory root. Storage module must return relative paths, not absolute paths, for media URLs to work.
metadata:
  type: feedback
---

**Rule:** When using `StaticFiles` to serve uploaded/generated media, `save_upload()` must return a relative path, not an absolute path.

**Why:** `StaticFiles(directory=str(STORAGE_ROOT))` mounted at `/files` expects URLs like `/files/assets/image.jpg`. If `save_upload()` returns `D:\projects\outputs\assets\image.jpg`, the frontend would construct `/files/D:\projects\outputs\assets\image.jpg` which is invalid. Relative paths like `assets/image.jpg` resolve correctly against the `STORAGE_ROOT`.

**How to apply:**
- `save_upload()` should return `f"{subdir}/{unique_name}"` instead of `str(dest_path)`
- `delete_file()` and `get_file_path()` should resolve by joining `STORAGE_ROOT / relative_path`
- Frontend should reference media with `/files/{url}`

**Reference:** Fixed in `backend/app/core/storage.py` during ShopShot P0 development.
