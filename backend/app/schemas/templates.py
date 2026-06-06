from pydantic import BaseModel, Field


class TemplateEntryRead(BaseModel):
    id: str
    title: str
    category: str
    category_label: str
    prompt: str
    hook: str = ""
    selling_points: list[str] = Field(default_factory=list)
    shot_plan: list[str] = Field(default_factory=list)
    cta: str = ""
    duration: int = 20
    ratio: str = "9:16"
    video_mode: str = "product_show"
    preview_video: str
    cover_image: str
    tags: list[str] = Field(default_factory=list)
    source: str = "bootstrap"
    is_new: bool = False


class TemplateCatalogStats(BaseModel):
    total: int
    target: int
    expanding: bool
    last_expanded_at: str | None = None
    categories: list[dict]
    videos_generated: int = 0
    videos_pending: int = 0
    video_gen_enabled: bool = False
    video_gen_interval_seconds: int = 30
    last_video_at: str | None = None
    last_video_error: str | None = None


class TemplateCatalogPage(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[TemplateEntryRead]
    stats: TemplateCatalogStats
