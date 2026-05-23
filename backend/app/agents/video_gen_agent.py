from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import Shot, ShotStatus, Asset, AssetType
from app.services.generation_service import GenerationService
from app.utils.seedance_client import get_seedance_client
from app.core.storage import save_upload
from app.config import get_settings
import requests

settings = get_settings()


class VideoGenAgent:
    def __init__(self, db: Session):
        self.db = db
        self.seedance = get_seedance_client()
        self.gen_service = GenerationService(db)

    def run(self, project_id: int, script_id: int, task_id: str = None) -> List[Shot]:
        from app.models import Project
        project = self.db.get(Project, project_id)

        result = self.db.execute(
            select(Shot).where(Shot.script_id == script_id).order_by(Shot.sequence)
        )
        shots = result.scalars().all()

        if task_id:
            self.gen_service.update_status(task_id, status="running", step="video_generate", progress=10)

        total = len(shots)
        for idx, shot in enumerate(shots):
            self._generate_shot_video(shot, project)
            if task_id:
                progress = 10 + int((idx + 1) / total * 70)
                self.gen_service.update_status(task_id, step="video_generate", progress=progress)

        if task_id:
            self.gen_service.update_status(task_id, step="video_generate", progress=80)

        return shots

    def _generate_shot_video(self, shot: Shot, project=None):
        self._update_shot_status(shot, ShotStatus.VIDEO_GENERATING)

        try:
            first_frame = None

            if shot.reference_asset_id:
                asset = self.db.get(Asset, shot.reference_asset_id)
                if asset:
                    first_frame = asset.url

            if not first_frame and settings.image_generation_enabled and shot.image_prompt:
                pass

            prompt = shot.action_prompt or shot.image_prompt or "Product showcase video"
            if not prompt or len(prompt.strip()) < 3:
                prompt = "Smooth product showcase, cinematic lighting"

            ratio = project.target_ratio if project else None
            resolution = project.target_resolution if project else None

            video_url = self.seedance.generate(
                prompt=prompt,
                first_frame=first_frame,
                duration=shot.duration,
                ratio=ratio,
                resolution=resolution,
            )

            resp = requests.get(video_url)
            resp.raise_for_status()
            filename = f"shot_{shot.id}_{shot.shot_id}.mp4"
            local_path = save_upload(resp.content, filename, subdir="videos")

            asset = Asset(
                project_id=shot.project_id,
                name=filename,
                type=AssetType.VIDEO,
                url=local_path,
                source="generated",
            )
            self.db.add(asset)
            self.db.flush()
            self.db.refresh(asset)

            shot.generated_video_asset_id = asset.id
            self._update_shot_status(shot, ShotStatus.VIDEO_COMPLETED)

        except Exception as e:
            self._update_shot_status(shot, ShotStatus.VIDEO_FAILED)
            raise

    def _update_shot_status(self, shot: Shot, status: ShotStatus):
        shot.status = status
        self.db.commit()
