from contextlib import asynccontextmanager
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

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
TEMPLATES_PUBLIC = PROJECT_ROOT / "frontend" / "public" / "templates"

init_db()


def _health_payload():
    from app.services.template_catalog_service import get_stats

    try:
        tpl_stats = get_stats()
    except Exception:
        tpl_stats = {"total": 0, "target": settings.template_expand_target, "expanding": False}
    return {
        "status": "ok",
        "mock_mode": settings.mock_mode,
        "seedance_ep_configured": bool(settings.doubao_seedance_ep),
        "comfyui_enabled": settings.comfyui_enabled,
        "comfyui_configured": bool(settings.comfyui_url),
        "volc_api_key_configured": bool(settings.volc_api_key),
        "storage": str(STORAGE_ROOT),
        "template_catalog_total": tpl_stats.get("total", 0),
        "template_expand_enabled": settings.template_expand_enabled,
    }


print(
    f"[ShopShot] mock_mode={settings.mock_mode} "
    f"seedance_ep={'yes' if settings.doubao_seedance_ep else 'NO'} "
    f"template_expand={'on' if settings.template_expand_enabled else 'off'} "
    f"template_video_gen={'on' if settings.template_video_gen_enabled else 'off'}"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    import logging

    from app.services.template_catalog_service import ensure_catalog
    from app.services.template_expander import expander_loop
    from app.services.template_video_gen import video_gen_loop

    logger = logging.getLogger("shopshot.templates")
    stop = asyncio.Event()
    expander_task = None
    video_gen_task = None

    try:
        ensure_catalog()
        logger.info("Template catalog ready (min=%s)", settings.template_catalog_min_count)
    except Exception as exc:
        logger.warning("Template catalog bootstrap failed: %s", exc)

    if settings.template_expand_enabled:
        expander_task = asyncio.create_task(expander_loop(stop))
        
    if settings.template_video_gen_enabled:
        video_gen_task = asyncio.create_task(video_gen_loop(stop))

    yield

    stop.set()
    if expander_task:
        try:
            await expander_task
        except asyncio.CancelledError:
            pass
    if video_gen_task:
        try:
            await video_gen_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
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

if TEMPLATES_PUBLIC.exists():
    app.mount("/templates", StaticFiles(directory=str(TEMPLATES_PUBLIC)), name="templates")

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
