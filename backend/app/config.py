from pydantic_settings import BaseSettings
from functools import lru_cache


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

    # Storage
    storage_type: str = "local"  # local or tos
    storage_local_path: str = "../outputs"

    # Seedance generation config
    seedance_concurrency: int = 3
    seedance_poll_interval: int = 10
    seedance_default_duration: int = 5
    seedance_default_ratio: str = "9:16"
    seedance_default_resolution: str = "720p"
    seedance_default_fps: int = 24
    seedance_watermark: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
