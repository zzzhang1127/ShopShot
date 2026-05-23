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
from app.api.v1 import assets, scripts, shots, generations, videos, agents, projects

settings = get_settings()

FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

init_db()

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
        return {"status": "ok"}

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        index_file = FRONTEND_DIST / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"detail": "Not found"}
else:
    @app.get("/health")
    def health():
        return {"status": "ok"}
