from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ProjectStatus(str, Enum):
    DRAFT = "draft"
    GENERATING = "generating"
    COMPLETED = "completed"


class AssetType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"


class ShotType(str, Enum):
    HOOK = "hook"
    PAIN_POINT = "pain_point"
    PRODUCT_REVEAL = "product_reveal"
    DEMO = "demo"
    SOCIAL_PROOF = "social_proof"
    CTA = "cta"


class TaskStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class TaskType(str, Enum):
    SCRIPT = "script"
    IMAGE = "image"
    VIDEO = "video"
    POSTPROCESS = "postprocess"


class ShotStatus(str, Enum):
    PENDING = "pending"
    IMAGE_GENERATING = "image_generating"
    IMAGE_COMPLETED = "image_completed"
    IMAGE_FAILED = "image_failed"
    VIDEO_GENERATING = "video_generating"
    VIDEO_COMPLETED = "video_completed"
    VIDEO_FAILED = "video_failed"
    EVALUATING = "evaluating"
    EVALUATED = "evaluated"


class VideoRatio(str, Enum):
    R9_16 = "9:16"
    R16_9 = "16:9"
    R1_1 = "1:1"
    R3_4 = "3:4"
    R4_3 = "4:3"
    R21_9 = "21:9"


class VideoResolution(str, Enum):
    P480 = "480p"
    P720 = "720p"
    P1080 = "1080p"


class VideoStatus(str, Enum):
    DRAFT = "draft"
    FINAL = "final"


class TemplateCategory(str, Enum):
    BEAUTY = "beauty"
    ELECTRONICS = "3c"
    FOOD = "food"
    FASHION = "fashion"
    HOME = "home"


class TemplateStyle(str, Enum):
    PROMOTION = "promotion"
    GRASS = "grass"
    STORY = "story"
    BRAND = "brand"


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    product_url: Optional[str] = None
    product_info: Optional[str] = None
    video_mode: Optional[str] = Field(default="product_show")
    target_platform: Optional[str] = Field(default="douyin")
    target_ratio: Optional[str] = Field(default="9:16")
    target_resolution: Optional[str] = Field(default="720p")
    target_audience: Optional[str] = None
    language: Optional[str] = Field(default="zh")
    status: ProjectStatus = Field(default=ProjectStatus.DRAFT)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    assets: List["Asset"] = Relationship(back_populates="project")
    scripts: List["Script"] = Relationship(back_populates="project")
    shots: List["Shot"] = Relationship(back_populates="project")
    tasks: List["GenerationTask"] = Relationship(back_populates="project")
    videos: List["Video"] = Relationship(back_populates="project")


class Asset(SQLModel, table=True):
    __tablename__ = "assets"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", index=True)
    name: str
    type: AssetType
    url: str
    mime_type: Optional[str] = None
    size: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    meta_data: Optional[str] = None
    analysis: Optional[str] = None
    source: Optional[str] = Field(default="upload")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    project: Optional[Project] = Relationship(back_populates="assets")
    referenced_shots: List["Shot"] = Relationship(
        back_populates="reference_asset",
        sa_relationship_kwargs={"foreign_keys": "Shot.reference_asset_id"}
    )
    last_frame_shots: List["Shot"] = Relationship(
        back_populates="last_frame_asset",
        sa_relationship_kwargs={"foreign_keys": "Shot.last_frame_asset_id"}
    )
    generated_image_shots: List["Shot"] = Relationship(
        back_populates="generated_image_asset",
        sa_relationship_kwargs={"foreign_keys": "Shot.generated_image_asset_id"}
    )
    generated_video_shots: List["Shot"] = Relationship(
        back_populates="generated_video_asset",
        sa_relationship_kwargs={"foreign_keys": "Shot.generated_video_asset_id"}
    )
    tts_audio_shots: List["Shot"] = Relationship(
        back_populates="tts_audio_asset",
        sa_relationship_kwargs={"foreign_keys": "Shot.tts_audio_asset_id"}
    )


class Script(SQLModel, table=True):
    __tablename__ = "scripts"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id")
    video_type: Optional[str] = None
    title: Optional[str] = None
    tags: Optional[str] = None
    strategy: Optional[str] = None
    factors: Optional[str] = None
    raw_config: Optional[str] = None
    status: str = Field(default="draft")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    project: Optional[Project] = Relationship(back_populates="scripts")
    shots: List["Shot"] = Relationship(back_populates="script")


class Shot(SQLModel, table=True):
    __tablename__ = "shots"

    id: Optional[int] = Field(default=None, primary_key=True)
    script_id: Optional[int] = Field(default=None, foreign_key="scripts.id")
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id")
    shot_id: str = Field(default="shot_1")
    type: Optional[ShotType] = None
    status: ShotStatus = Field(default=ShotStatus.PENDING)
    image_prompt: Optional[str] = None
    action_prompt: Optional[str] = None
    reference_asset_id: Optional[int] = Field(default=None, foreign_key="assets.id")
    last_frame_asset_id: Optional[int] = Field(default=None, foreign_key="assets.id")
    generated_image_asset_id: Optional[int] = Field(default=None, foreign_key="assets.id")
    generated_video_asset_id: Optional[int] = Field(default=None, foreign_key="assets.id")
    tts_audio_asset_id: Optional[int] = Field(default=None, foreign_key="assets.id")
    words: Optional[str] = None
    duration: int = Field(default=5)
    sequence: int = Field(default=0)
    variant_index: Optional[int] = Field(default=None)

    script: Optional[Script] = Relationship(back_populates="shots")
    project: Optional[Project] = Relationship(back_populates="shots")
    reference_asset: Optional[Asset] = Relationship(
        back_populates="referenced_shots",
        sa_relationship_kwargs={"foreign_keys": "Shot.reference_asset_id"}
    )
    last_frame_asset: Optional[Asset] = Relationship(
        back_populates="last_frame_shots",
        sa_relationship_kwargs={"foreign_keys": "Shot.last_frame_asset_id"}
    )
    generated_image_asset: Optional[Asset] = Relationship(
        back_populates="generated_image_shots",
        sa_relationship_kwargs={"foreign_keys": "Shot.generated_image_asset_id"}
    )
    generated_video_asset: Optional[Asset] = Relationship(
        back_populates="generated_video_shots",
        sa_relationship_kwargs={"foreign_keys": "Shot.generated_video_asset_id"}
    )
    tts_audio_asset: Optional[Asset] = Relationship(
        back_populates="tts_audio_shots",
        sa_relationship_kwargs={"foreign_keys": "Shot.tts_audio_asset_id"}
    )


class GenerationTask(SQLModel, table=True):
    __tablename__ = "generation_tasks"

    id: str = Field(primary_key=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", index=True)
    type: TaskType
    status: TaskStatus = Field(default=TaskStatus.QUEUED, index=True)
    payload: str
    result: Optional[str] = None
    error: Optional[str] = None
    progress: int = Field(default=0)
    retry_count: int = Field(default=0)
    parent_task_id: Optional[str] = None
    executor_task_id: Optional[str] = None
    agent_name: Optional[str] = None
    step: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    project: Optional[Project] = Relationship(back_populates="tasks")
    links: List["GenerationTaskLink"] = Relationship(back_populates="task")


class GenerationTaskLink(SQLModel, table=True):
    __tablename__ = "generation_task_links"

    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: str = Field(foreign_key="generation_tasks.id", index=True)
    entity_type: str
    entity_id: int
    link_status: str = Field(default="active")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    task: Optional[GenerationTask] = Relationship(back_populates="links")


class Video(SQLModel, table=True):
    __tablename__ = "videos"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id")
    task_id: Optional[str] = Field(default=None, foreign_key="generation_tasks.id")
    url: str
    thumbnail_url: Optional[str] = None
    ratio: Optional[VideoRatio] = None
    resolution: Optional[VideoResolution] = None
    duration: Optional[int] = None
    file_size: Optional[int] = None
    status: VideoStatus = Field(default=VideoStatus.DRAFT)
    factors: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    project: Optional[Project] = Relationship(back_populates="videos")
