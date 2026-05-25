import os
import uuid
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import Shot, Asset, AssetType, Video, VideoStatus, VideoRatio, VideoResolution, TaskStatus
from app.services.generation_service import GenerationService
from app.services.video_service import VideoService
from app.utils.ffmpeg_utils import concat_videos, fit_video_duration
from app.core.storage import STORAGE_ROOT


class PostProcessAgent:
    def __init__(self, db: Session):
        self.db = db
        self.gen_service = GenerationService(db)
        self.video_service = VideoService(db)

    def run(
        self,
        project_id: int,
        script_id: int,
        task_id: str = None,
        target_duration: int | None = None,
    ) -> Video:
        from app.models import Project
        project = self.db.get(Project, project_id)

        if task_id:
            self.gen_service.update_status(task_id, TaskStatus.RUNNING, step="postprocess", progress=85)

        result = self.db.execute(
            select(Shot).where(Shot.script_id == script_id).order_by(Shot.sequence)
        )
        shots = result.scalars().all()

        video_paths = []
        for shot in shots:
            if shot.generated_video_asset_id:
                asset = self.db.get(Asset, shot.generated_video_asset_id)
                if asset:
                    video_paths.append(asset.url)

        if not video_paths:
            raise RuntimeError("No video segments available for concatenation")

        if task_id:
            self.gen_service.update_status(task_id, TaskStatus.RUNNING, step="postprocess", progress=90)

        output_name = f"final_{project_id}_{uuid.uuid4().hex[:8]}.mp4"
        output_path = str(STORAGE_ROOT / "videos" / output_name)
        concat_videos(video_paths, output_path)

        if target_duration:
            fitted_name = f"final_{project_id}_{uuid.uuid4().hex[:8]}_{target_duration}s.mp4"
            fitted_path = str(STORAGE_ROOT / "videos" / fitted_name)
            fit_video_duration(output_path, fitted_path, target_duration)
            output_name = fitted_name
            output_path = fitted_path

        if task_id:
            self.gen_service.update_status(task_id, TaskStatus.RUNNING, step="postprocess", progress=95)

        file_size = os.path.getsize(output_path)

        asset = Asset(
            project_id=project_id,
            name=output_name,
            type=AssetType.VIDEO,
            url=f"videos/{output_name}",
            size=file_size,
            duration=target_duration,
            source="generated",
        )
        self.db.add(asset)
        self.db.flush()

        ratio = VideoRatio.R9_16
        resolution = VideoResolution.P720
        if project and project.target_ratio:
            try:
                ratio = VideoRatio(f"r{project.target_ratio.replace(':', '_')}")
            except ValueError:
                pass
        if project and project.target_resolution:
            try:
                resolution = VideoResolution(f"p{project.target_resolution.replace('p', '')}")
            except ValueError:
                pass

        video = self.video_service.create(
            project_id=project_id,
            url=f"videos/{output_name}",
            task_id=task_id,
            ratio=ratio,
            resolution=resolution,
            duration=target_duration,
            file_size=file_size,
        )

        if task_id:
            self.gen_service.update_status(task_id, TaskStatus.RUNNING, step="postprocess", progress=100)

        return video
