from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import Shot, ShotStatus, Asset, AssetType, TaskStatus
from app.services.generation_service import GenerationService
from app.utils.seedance_client import get_seedance_client
from app.utils.media_url import local_asset_to_image_url
from app.core.storage import save_upload, STORAGE_ROOT
from app.config import get_settings
from app.utils.video_download import download_video_from_url
from app.utils.ffmpeg_utils import extract_last_frame
from pathlib import Path

settings = get_settings()


class VideoGenAgent:
    def __init__(self, db: Session):
        self.db = db
        self.seedance = get_seedance_client()
        self.gen_service = GenerationService(db)

    def run(
        self,
        project_id: int,
        script_id: int,
        task_id: str = None,
        total_duration: int | None = None,
    ) -> List[Shot]:
        from app.models import Project
        project = self.db.get(Project, project_id)

        result = self.db.execute(
            select(Shot).where(Shot.script_id == script_id).order_by(Shot.sequence)
        )
        shots = result.scalars().all()

        if task_id:
            self.gen_service.update_status(task_id, TaskStatus.RUNNING, step="video_generate", progress=10)

        # Seedance 单镜头生成通常更适合 5 秒以上；总时长由后处理统一压缩/修剪。
        per_shot_duration = max(5, int((total_duration or 15) / max(len(shots), 1)))
        total = max(len(shots), 1)
        previous_tail_asset_id = None
        for idx, shot in enumerate(shots):
            if previous_tail_asset_id and not shot.reference_asset_id:
                shot.reference_asset_id = previous_tail_asset_id
            shot.duration = per_shot_duration
            self.db.commit()
            if task_id:
                base = 10 + int(idx / total * 70)
                self.gen_service.update_status(
                    task_id,
                    TaskStatus.RUNNING,
                    step=f"video_shot_{idx + 1}_of_{total}",
                    progress=base,
                )

            def make_poll_cb(shot_base: int, shot_span: int):
                def _cb(sub_pct: int, ark_status: str):
                    if not task_id:
                        return
                    p = shot_base + int(shot_span * sub_pct / 100)
                    self.gen_service.update_status(
                        task_id,
                        TaskStatus.RUNNING,
                        step=f"video_shot_{idx + 1}_seedance_{ark_status}",
                        progress=min(p, 85),
                    )
                return _cb

            shot_span = int(70 / total)
            self._generate_shot_video(
                shot,
                project,
                shot_index=idx,
                total_shots=total,
                on_poll=make_poll_cb(10 + int(idx / total * 70), shot_span),
            )
            previous_tail_asset_id = shot.last_frame_asset_id
            if task_id:
                progress = 10 + int((idx + 1) / total * 70)
                self.gen_service.update_status(
                    task_id, TaskStatus.RUNNING, step=f"video_shot_{idx + 1}_done", progress=progress
                )

        if task_id:
            self.gen_service.update_status(task_id, TaskStatus.RUNNING, step="video_generate", progress=80)

        return shots

    def _build_seedance_prompt(self, shot: Shot, project=None, shot_index: int = 0, total_shots: int = 1) -> str:
        product_info = (project.product_info if project else "") or ""
        image_prompt = (shot.image_prompt or "").strip()
        action_prompt = (shot.action_prompt or "").strip()
        words = (shot.words or "").strip()

        stage_names = ["Attention hook", "Interest scene", "Desire close-up", "Call-to-action ending"]
        stage = stage_names[shot_index] if shot_index < len(stage_names) else f"Shot {shot_index + 1}"
        return (
            f"Product: {product_info}. "
            f"Video type: ecommerce product selling video for TikTok Shop. "
            f"Shot {shot_index + 1}/{total_shots}: {stage}. "
            f"Visual subject and scene: {image_prompt}. "
            f"Camera movement: {action_prompt}. "
            f"Caption/voiceover meaning: {words}. "
            "The product described above must be the main visible subject in every frame. "
            "Keep the same product identity, color, material, style, and commercial advertising look. "
            "Do not replace it with landscapes, unrelated people, unrelated products, or abstract color blocks. "
            "High quality ecommerce ad, premium lighting, clear product details."
        )

    def _generate_shot_video(self, shot: Shot, project=None, shot_index: int = 0, total_shots: int = 1, on_poll=None):
        self._update_shot_status(shot, ShotStatus.VIDEO_GENERATING)

        try:
            first_frame = None

            if shot.reference_asset_id:
                asset = self.db.get(Asset, shot.reference_asset_id)
                if asset:
                    first_frame = local_asset_to_image_url(asset.url)

            if not first_frame and shot.project_id and shot_index == 0:
                result = self.db.execute(
                    select(Asset).where(
                        Asset.project_id == shot.project_id,
                        Asset.type == "image",
                        Asset.source == "upload",
                    )
                )
                img = result.scalars().first()
                if img:
                    first_frame = local_asset_to_image_url(img.url)

            prompt = self._build_seedance_prompt(shot, project, shot_index, total_shots)
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
                on_poll=on_poll,
            )

            file_bytes = download_video_from_url(video_url)
            filename = f"shot_{shot.id}_{shot.shot_id}.mp4"
            local_path = save_upload(file_bytes, filename, subdir="videos")

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

            last_frame_name = f"shot_{shot.id}_{shot.shot_id}_last.jpg"
            last_frame_path = STORAGE_ROOT / "assets" / last_frame_name
            last_frame_path.parent.mkdir(parents=True, exist_ok=True)
            extract_last_frame(str(STORAGE_ROOT / local_path), str(last_frame_path))
            last_asset = Asset(
                project_id=shot.project_id,
                name=last_frame_name,
                type=AssetType.IMAGE,
                url=f"assets/{last_frame_name}",
                source="generated",
            )
            self.db.add(last_asset)
            self.db.flush()
            self.db.refresh(last_asset)
            shot.last_frame_asset_id = last_asset.id
            self._update_shot_status(shot, ShotStatus.VIDEO_COMPLETED)

        except Exception as e:
            self._update_shot_status(shot, ShotStatus.VIDEO_FAILED)
            raise

    def _update_shot_status(self, shot: Shot, status: ShotStatus):
        shot.status = status
        self.db.commit()
