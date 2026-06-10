import os
import uuid
import shutil
import logging
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import Shot, Asset, AssetType, Video, VideoRatio, VideoResolution, TaskStatus
from app.services.generation_service import GenerationService
from app.services.video_service import VideoService
from app.utils.ffmpeg_utils import (
    concat_videos, fit_video_duration, add_bgm,
    add_tts_to_video, ensure_audio_track,
)
from app.core.storage import STORAGE_ROOT

logger = logging.getLogger(__name__)

# Default BGM preset to use when none is configured
_DEFAULT_BGM_PRESET_ID = "bgm_calm"
_STATIC_BGM_DIR = Path(__file__).resolve().parents[2] / "static" / "bgm"


def _auto_apply_bgm(project_id: int, db: Session) -> Asset | None:
    """Return the project's latest BGM asset, auto-creating one from the
    default preset when the project has none yet."""
    from app.api.v1.assets import _BGM_PRESETS

    bgm_result = db.execute(
        select(Asset)
        .where(
            Asset.project_id == project_id,
            Asset.type == AssetType.AUDIO,
            Asset.source == "bgm",
        )
        .order_by(Asset.id.desc())
    )
    existing = bgm_result.scalars().first()
    if existing:
        return existing

    # Try default preset, then any available preset
    presets_to_try = [
        p for p in _BGM_PRESETS if p["id"] == _DEFAULT_BGM_PRESET_ID
    ] + [p for p in _BGM_PRESETS if p["id"] != _DEFAULT_BGM_PRESET_ID]

    for preset in presets_to_try:
        file_path = _STATIC_BGM_DIR / preset["filename"]
        if not file_path.is_file():
            continue
        try:
            from app.services.asset_service import AssetService
            svc = AssetService(db)
            asset = svc.create(
                project_id=project_id,
                name=preset["filename"],
                type=AssetType.AUDIO,
                file_bytes=file_path.read_bytes(),
                filename=preset["filename"],
                source="bgm",
            )
            logger.info("Auto-applied BGM preset '%s' for project %d", preset["id"], project_id)
            return asset
        except Exception as exc:
            logger.warning("Failed to auto-apply BGM preset '%s': %s", preset["id"], exc)

    return None


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
        from app.utils.tts_client import DEFAULT_VOICE, generate_tts, is_available as tts_available

        project = self.db.get(Project, project_id)

        if task_id:
            self.gen_service.update_status(task_id, TaskStatus.RUNNING, step="postprocess", progress=85)

        result = self.db.execute(
            select(Shot).where(Shot.script_id == script_id).order_by(Shot.sequence)
        )
        shots = result.scalars().all()

        video_paths: list[str] = []
        for shot in shots:
            if shot.generated_video_asset_id:
                asset = self.db.get(Asset, shot.generated_video_asset_id)
                if asset:
                    video_paths.append(asset.url)

        if not video_paths:
            raise RuntimeError("No video segments available for concatenation")

        # ── Auto-enable TTS if any shot has narration text ───────────────────
        has_words = any((s.words or "").strip() for s in shots)
        if has_words and not enable_tts:
            enable_tts = True
            if not tts_voice:
                tts_voice = DEFAULT_VOICE
            logger.info("Auto-enabled TTS (default voice: %s)", tts_voice)

        # ── TTS per-shot: mix narration, store as asset, update shot ref ─────
        if enable_tts and tts_available():
            try:
                tts_dir = STORAGE_ROOT / "audio" / "tts"
                tts_dir.mkdir(parents=True, exist_ok=True)
                tts_video_paths: list[str] = []

                for shot in shots:
                    if not shot.generated_video_asset_id:
                        continue
                    orig_asset = self.db.get(Asset, shot.generated_video_asset_id)
                    if not orig_asset:
                        continue

                    words = (shot.words or "").strip()
                    mixed_name = f"shot_{shot.id}_tts_{uuid.uuid4().hex[:6]}.mp4"
                    mixed_path = str(STORAGE_ROOT / "videos" / mixed_name)

                    if words:
                        # Generate TTS audio
                        tts_name = f"tts_{shot.id}_{uuid.uuid4().hex[:6]}.mp3"
                        tts_path = str(tts_dir / tts_name)
                        generate_tts(words, tts_path, voice=tts_voice)

                        # Mix TTS onto shot video
                        add_tts_to_video(orig_asset.url, tts_path, mixed_path)

                        # Persist TTS audio asset
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
                    else:
                        # No narration — add silent audio for stream consistency
                        ensure_audio_track(orig_asset.url, mixed_path)

                    # Also add BGM to this individual shot so Block4 preview has music
                    latest_bgm_for_shot = _auto_apply_bgm(project_id, self.db)
                    if latest_bgm_for_shot:
                        shot_bgm_name = f"shot_{shot.id}_bgm_{uuid.uuid4().hex[:6]}.mp4"
                        shot_bgm_path = str(STORAGE_ROOT / "videos" / shot_bgm_name)
                        try:
                            add_bgm(mixed_path, latest_bgm_for_shot.url, shot_bgm_path, bgm_volume=0.22)
                            mixed_name = shot_bgm_name
                            mixed_path = shot_bgm_path
                        except Exception as exc:
                            logger.warning("Shot BGM mixing failed for shot %s: %s", shot.id, exc)

                    # Store TTS+BGM mixed video as a new asset and update shot reference
                    mixed_size = os.path.getsize(mixed_path)
                    mixed_asset = Asset(
                        project_id=project_id,
                        name=mixed_name,
                        type=AssetType.VIDEO,
                        url=f"videos/{mixed_name}",
                        size=mixed_size,
                        source="generated",
                    )
                    self.db.add(mixed_asset)
                    self.db.flush()
                    shot.generated_video_asset_id = mixed_asset.id
                    self.db.flush()

                    tts_video_paths.append(f"videos/{mixed_name}")

                if tts_video_paths:
                    video_paths = tts_video_paths

            except Exception as exc:
                logger.warning("TTS generation failed (non-fatal): %s", exc)
        elif enable_tts:
            logger.warning("TTS requested but edge-tts is not installed; skipping TTS.")

        if task_id:
            self.gen_service.update_status(task_id, TaskStatus.RUNNING, step="postprocess", progress=90)

        # ── Concatenate all (TTS-mixed) shot videos ───────────────────────────
        output_name = f"final_{project_id}_{uuid.uuid4().hex[:8]}.mp4"
        output_path = str(STORAGE_ROOT / "videos" / output_name)
        concat_videos(video_paths, output_path, encode_audio=enable_tts)

        # ── Optional: fit to target duration ─────────────────────────────────
        if target_duration:
            fitted_name = f"final_{project_id}_{uuid.uuid4().hex[:8]}_{target_duration}s.mp4"
            fitted_path = str(STORAGE_ROOT / "videos" / fitted_name)
            fit_video_duration(output_path, fitted_path, target_duration)
            output_name = fitted_name
            output_path = fitted_path

        # ── BGM: auto-select if project has none ─────────────────────────────
        latest_bgm = _auto_apply_bgm(project_id, self.db)
        if latest_bgm:
            mixed_name = f"final_{project_id}_{uuid.uuid4().hex[:8]}_bgm.mp4"
            mixed_path = str(STORAGE_ROOT / "videos" / mixed_name)
            try:
                add_bgm(output_path, latest_bgm.url, mixed_path, bgm_volume=0.22)
                output_name = mixed_name
                output_path = mixed_path
            except Exception as exc:
                logger.warning("BGM mixing failed (non-fatal): %s", exc)

        if task_id:
            self.gen_service.update_status(task_id, TaskStatus.RUNNING, step="postprocess", progress=95)

        file_size = os.path.getsize(output_path)

        final_asset = Asset(
            project_id=project_id,
            name=output_name,
            type=AssetType.VIDEO,
            url=f"videos/{output_name}",
            size=file_size,
            duration=target_duration,
            source="generated",
        )
        self.db.add(final_asset)
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
