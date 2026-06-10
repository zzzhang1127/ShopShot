import os
import uuid
import logging
import tempfile
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import Shot, Asset, AssetType, Video, VideoStatus, VideoRatio, VideoResolution, TaskStatus
from app.services.generation_service import GenerationService
from app.services.video_service import VideoService
from app.utils.ffmpeg_utils import concat_videos, fit_video_duration, add_bgm, add_tts_to_video, ensure_audio_track
from app.core.storage import STORAGE_ROOT

logger = logging.getLogger(__name__)


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
        enable_tts: bool = False,
        tts_voice: str = "zh-CN-XiaoxiaoNeural",
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

        # ── TTS per-shot narration ───────────────────────────────────────────
        if enable_tts:
            try:
                from app.utils.tts_client import generate_tts, is_available
                if is_available():
                    tts_video_paths = []
                    tts_dir = STORAGE_ROOT / "audio" / "tts"
                    tts_dir.mkdir(parents=True, exist_ok=True)
                    for idx, shot in enumerate(shots):
                        if not shot.generated_video_asset_id:
                            continue
                        asset = self.db.get(Asset, shot.generated_video_asset_id)
                        if not asset:
                            continue
                        words = (shot.words or "").strip()
                        if not words:
                            # No narration text – add silent audio so all
                            # segments have consistent stream layout for concat
                            silent_name = f"shot_{shot.id}_silent_{uuid.uuid4().hex[:6]}.mp4"
                            silent_path = str(STORAGE_ROOT / "videos" / silent_name)
                            try:
                                ensure_audio_track(asset.url, silent_path)
                                tts_video_paths.append(f"videos/{silent_name}")
                            except Exception:
                                tts_video_paths.append(asset.url)
                            continue
                        # Generate TTS audio
                        tts_name = f"tts_{shot.id}_{uuid.uuid4().hex[:6]}.mp3"
                        tts_path = str(tts_dir / tts_name)
                        generate_tts(words, tts_path, voice=tts_voice)
                        # Mix TTS onto shot video
                        mixed_name = f"shot_{shot.id}_tts_{uuid.uuid4().hex[:6]}.mp4"
                        mixed_path = str(STORAGE_ROOT / "videos" / mixed_name)
                        add_tts_to_video(asset.url, tts_path, mixed_path)
                        # Store TTS audio as asset and record on shot
                        tts_asset = Asset(
                            project_id=project_id,
                            name=tts_name,
                            type=AssetType.AUDIO,
                            url=f"audio/tts/{tts_name}",
                            source="tts",
                        )
                        self.db.add(tts_asset)
                        self.db.flush()
                        shot.tts_audio_asset_id = tts_asset.id
                        self.db.flush()
                        tts_video_paths.append(f"videos/{mixed_name}")
                    if tts_video_paths:
                        video_paths = tts_video_paths
                else:
                    logger.warning("TTS requested but edge-tts is not installed; skipping TTS.")
            except Exception as exc:
                logger.warning("TTS generation failed (non-fatal): %s", exc)

        if task_id:
            self.gen_service.update_status(task_id, TaskStatus.RUNNING, step="postprocess", progress=90)

        output_name = f"final_{project_id}_{uuid.uuid4().hex[:8]}.mp4"
        output_path = str(STORAGE_ROOT / "videos" / output_name)
        concat_videos(video_paths, output_path, encode_audio=enable_tts)

        if target_duration:
            fitted_name = f"final_{project_id}_{uuid.uuid4().hex[:8]}_{target_duration}s.mp4"
            fitted_path = str(STORAGE_ROOT / "videos" / fitted_name)
            fit_video_duration(output_path, fitted_path, target_duration)
            output_name = fitted_name
            output_path = fitted_path

        # Optional: automatically mix latest uploaded BGM (source=bgm)
        bgm_result = self.db.execute(
            select(Asset)
            .where(
                Asset.project_id == project_id,
                Asset.type == AssetType.AUDIO,
                Asset.source == "bgm",
            )
            .order_by(Asset.id.desc())
        )
        latest_bgm = bgm_result.scalars().first()
        if latest_bgm:
            mixed_name = f"final_{project_id}_{uuid.uuid4().hex[:8]}_bgm.mp4"
            mixed_path = str(STORAGE_ROOT / "videos" / mixed_name)
            try:
                add_bgm(output_path, latest_bgm.url, mixed_path, bgm_volume=0.22)
                output_name = mixed_name
                output_path = mixed_path
            except Exception:
                # Invalid or unsupported BGM should not fail the whole generation.
                pass

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
