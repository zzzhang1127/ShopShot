from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

# 仅使用项目根目录 .env（与前端 Vite envDir 一致）
_BACKEND_DIR = Path(__file__).resolve().parents[1]
_PROJECT_ROOT = _BACKEND_DIR.parent
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    app_name: str = "ShopShot"
    debug: bool = True

    # Database
    database_url: str = "sqlite:///./shopshot.db"

    # Volcengine / Ark API
    volc_base_url: str = "https://ark.cn-beijing.volces.com/api/v3"
    volc_api_key: str = ""
    doubao_seed_ep: str = ""  # Seed-2.0-pro endpoint
    doubao_seedance_ep: str = ""  # Seedance-1.5-pro endpoint

    # Feature flags
    image_generation_enabled: bool = False
    seedream_api_key: str = ""
    mock_mode: bool = False  # 必须为 false，走真实火山 API

    # Storage
    storage_type: str = "local"  # local or tos
    storage_local_path: str = "../outputs"

    # Seedance generation config（RPM 敏感：默认串行 + 提交间隔）
    seedance_concurrency: int = 1
    seedance_min_submit_interval: int = 15
    seedance_max_retry: int = 6
    seedance_rate_limit_wait_seconds: int = 45
    seedance_poll_interval: int = 10
    seedance_default_duration: int = 5
    seedance_default_ratio: str = "9:16"
    seedance_default_resolution: str = "720p"
    seedance_default_fps: int = 24
    seedance_watermark: bool = False

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE) if _ENV_FILE.is_file() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
