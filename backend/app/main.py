from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import get_settings
from app.core.database import init_db
from app.core.storage import STORAGE_ROOT
from app.core.exceptions import (
    ShopShotException,
    http_exception_handler,
    shopshot_exception_handler,
    generic_exception_handler,
)
from app.api.v1 import assets, scripts, shots, generations, videos, agents, projects, comfy, resources, library, pixelle

settings = get_settings()

FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

init_db()


def _health_payload():
    return {
        "status": "ok",
        "mock_mode": settings.mock_mode,
        "seedance_ep_configured": bool(settings.doubao_seedance_ep),
        "comfyui_enabled": settings.comfyui_enabled,
        "comfyui_configured": bool(settings.comfyui_url),
        "volc_api_key_configured": bool(settings.volc_api_key),
        "storage": str(STORAGE_ROOT),
    }


print(
    f"[ShopShot] mock_mode={settings.mock_mode} "
    f"seedance_ep={'yes' if settings.doubao_seedance_ep else 'NO'}"
)

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(ShopShotException, shopshot_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.include_router(assets.router, prefix="/api/v1", tags=["Assets"])
app.include_router(scripts.router, prefix="/api/v1", tags=["Scripts"])
app.include_router(shots.router, prefix="/api/v1", tags=["Shots"])
app.include_router(generations.router, prefix="/api/v1", tags=["Generations"])
app.include_router(videos.router, prefix="/api/v1", tags=["Videos"])
app.include_router(agents.router, prefix="/api/v1", tags=["Agents"])
app.include_router(projects.router, prefix="/api/v1", tags=["Projects"])
app.include_router(comfy.router, prefix="/api/v1", tags=["ComfyUI"])
app.include_router(resources.router, prefix="/api/v1", tags=["Resources"])
app.include_router(library.router, prefix="/api/v1", tags=["Library"])
app.include_router(pixelle.router, prefix="/api/v1", tags=["Pixelle"])


@app.get("/api/v1/health")
def api_health():
    return _health_payload()


app.mount("/files", StaticFiles(directory=str(STORAGE_ROOT)), name="files")

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/favicon.svg")
    def favicon():
        return FileResponse(FRONTEND_DIST / "favicon.svg")

    @app.get("/icons.svg")
    def icons():
        return FileResponse(FRONTEND_DIST / "icons.svg")

    @app.get("/health")
    def health():
        return _health_payload()

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        index_file = FRONTEND_DIST / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"detail": "Not found"}
else:
    @app.get("/health")
    def health():
        return _health_payload()
