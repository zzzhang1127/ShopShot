import os
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
from app.models import Video, VideoStatus
from app.core.storage import STORAGE_ROOT
from app.core.exceptions import ShopShotException


class VideoService:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        project_id: int,
        url: str,
        task_id: Optional[str] = None,
        ratio: Optional[str] = None,
        resolution: Optional[str] = None,
        duration: Optional[int] = None,
        file_size: Optional[int] = None,
    ) -> Video:
        video = Video(
            project_id=project_id,
            url=url,
            task_id=task_id,
            ratio=ratio,
            resolution=resolution,
            duration=duration,
            file_size=file_size,
            status=VideoStatus.DRAFT,
        )
        self.db.add(video)
        self.db.commit()
        self.db.refresh(video)
        return video

    def get(self, video_id: int) -> Optional[Video]:
        return self.db.get(Video, video_id)

    def list_by_project(self, project_id: int) -> List[Video]:
        result = self.db.execute(
            select(Video).where(Video.project_id == project_id).order_by(Video.id.desc())
        )
        return result.scalars().all()

    def update(self, video_id: int, **kwargs) -> Video:
        video = self.get(video_id)
        if not video:
            raise ShopShotException(404, "Video not found")
        for k, v in kwargs.items():
            if hasattr(video, k):
                setattr(video, k, v)
        self.db.commit()
        self.db.refresh(video)
        return video
