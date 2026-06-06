"""后台利用 Seedance API 持续为带货模板生成独立预览视频。"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import requests

from app.config import get_settings
from app.services.template_catalog_service import _lock, _load_raw, catalog_path, update_template_media
from app.utils.seedance_client import SeedanceRateLimitError, get_seedance_client

logger = logging.getLogger(__name__)

GENERATED_PREFIX = "/templates/generated/"
_FAIL_COOLDOWN_SECONDS = 600  # 同一模板失败后 10 分钟内不重试


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _generated_dir() -> Path:
    return _project_root() / "frontend" / "public" / "templates" / "generated"


def _video_meta_path() -> Path:
    return catalog_path().with_name("video_gen_meta.json")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_video_meta() -> dict:
    path = _video_meta_path()
    if not path.is_file():
        return {"failures": {}, "last_success_at": None, "last_error": None}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"failures": {}, "last_success_at": None, "last_error": None}


def _save_video_meta(meta: dict) -> None:
    path = _video_meta_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def _record_failure(tpl_id: str, error: str) -> None:
    meta = _load_video_meta()
    failures = meta.setdefault("failures", {})
    failures[tpl_id] = {"at": _now_iso(), "error": error[:500]}
    meta["last_error"] = error[:500]
    _save_video_meta(meta)


def _record_success(tpl_id: str) -> None:
    meta = _load_video_meta()
    failures = meta.setdefault("failures", {})
    failures.pop(tpl_id, None)
    meta["last_success_at"] = _now_iso()
    meta["last_tpl_id"] = tpl_id
    _save_video_meta(meta)


def _is_on_cooldown(tpl_id: str) -> bool:
    meta = _load_video_meta()
    rec = meta.get("failures", {}).get(tpl_id)
    if not rec:
        return False
    try:
        failed_at = datetime.fromisoformat(rec["at"].replace("Z", "+00:00"))
    except ValueError:
        return False
    elapsed = (datetime.now(timezone.utc) - failed_at).total_seconds()
    return elapsed < _FAIL_COOLDOWN_SECONDS


def _has_generated_file(tpl: dict) -> bool:
    preview = tpl.get("preview_video", "")
    if not preview.startswith(GENERATED_PREFIX):
        return False
    rel = preview.removeprefix(GENERATED_PREFIX)
    return (_generated_dir() / rel).is_file()


def build_seedance_prompt(tpl: dict) -> str:
    """将模板结构化字段合成为 Seedance 高质量带货预览 Prompt。"""
    title = (tpl.get("title") or "").strip()
    hook = (tpl.get("hook") or "").strip()
    cta = (tpl.get("cta") or "").strip()
    base = (tpl.get("prompt") or "").strip()
    category = (tpl.get("category_label") or tpl.get("category") or "").strip()
    selling = [str(s).strip() for s in (tpl.get("selling_points") or []) if str(s).strip()]
    shots = [str(s).strip() for s in (tpl.get("shot_plan") or []) if str(s).strip()]

    parts = [
        "E-commerce short video ad for TikTok Shop.",
        f"Product category: {category}." if category else "",
        f"Product: {title}." if title else "",
        f"Opening hook (first 3 seconds): {hook}." if hook else "",
        f"Creative brief: {base}." if base else "",
    ]
    if selling:
        parts.append("Key selling points: " + "; ".join(selling[:5]) + ".")
    if shots:
        parts.append("Shot sequence: " + " | ".join(shots[:4]) + ".")
    if cta:
        parts.append(f"Ending CTA: {cta}.")
    parts.extend(
        [
            "Vertical 9:16 mobile frame, premium commercial lighting, sharp product details.",
            "The product must remain the main visible subject in every frame.",
            "Natural human hands or model optional; no unrelated scenery or abstract backgrounds.",
            "Cinematic but authentic UGC-meets-brand ad style, suitable for social commerce.",
        ]
    )
    return " ".join(p for p in parts if p)


def count_video_progress() -> dict:
    with _lock:
        templates = list(_load_raw().get("templates", []))
    total = len(templates)
    generated = sum(1 for t in templates if _has_generated_file(t))
    pending = total - generated
    meta = _load_video_meta()
    settings = get_settings()
    return {
        "total": total,
        "videos_generated": generated,
        "videos_pending": pending,
        "video_gen_enabled": settings.template_video_gen_enabled,
        "video_gen_interval_seconds": settings.template_video_gen_interval_seconds,
        "last_video_at": meta.get("last_success_at"),
        "last_video_error": meta.get("last_error"),
    }


def get_pending_template() -> dict | None:
    """取下一个需要生成独立预览视频的模板（跳过冷却中的失败项）。"""
    with _lock:
        templates = list(_load_raw().get("templates", []))
    for t in templates:
        if _has_generated_file(t):
            continue
        if _is_on_cooldown(t.get("id", "")):
            continue
        return t
    return None


def _download_video(url: str, out_path: Path, retries: int = 3) -> None:
    """下载 Seedance 返回的视频，带重试与断点清理。"""
    session = requests.Session()
    session.headers.update({"User-Agent": "ShopShot/1.0"})
    last_err: Exception | None = None
    for attempt in range(retries):
        tmp = out_path.with_suffix(".mp4.part")
        try:
            if tmp.exists():
                tmp.unlink()
            with session.get(url, stream=True, timeout=(30, 300)) as r:
                r.raise_for_status()
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(chunk_size=256 * 1024):
                        if chunk:
                            f.write(chunk)
            if tmp.stat().st_size < 10_000:
                raise RuntimeError("Downloaded file too small")
            tmp.replace(out_path)
            return
        except Exception as e:
            last_err = e
            tmp.unlink(missing_ok=True)
            out_path.unlink(missing_ok=True)
            logger.warning("Video download attempt %s/%s failed: %s", attempt + 1, retries, e)
    raise RuntimeError(f"Video download failed after {retries} retries: {last_err}")


def generate_video_for_template(tpl: dict) -> bool:
    settings = get_settings()
    if settings.mock_mode or not settings.volc_api_key or not settings.doubao_seedance_ep:
        logger.warning("Seedance not configured; skip template video gen")
        return False

    tpl_id = tpl.get("id", "")
    prompt = build_seedance_prompt(tpl)
    if len(prompt.strip()) < 20:
        logger.warning("Template %s prompt too short, skip", tpl_id)
        return False

    client = get_seedance_client()
    logger.info("Generating preview video for %s: %s", tpl_id, tpl.get("title"))

    try:
        video_url = client.generate(
            prompt=prompt,
            duration=settings.seedance_default_duration,
            ratio=tpl.get("ratio") or settings.seedance_default_ratio,
            resolution=settings.seedance_default_resolution,
        )

        out_dir = _generated_dir()
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{tpl_id}.mp4"

        _download_video(video_url, out_path)

        new_url = f"{GENERATED_PREFIX}{tpl_id}.mp4"
        update_template_media(tpl_id, preview_video=new_url)
        _record_success(tpl_id)
        logger.info("Saved template preview: %s", new_url)
        return True
    except SeedanceRateLimitError as e:
        _record_failure(tpl_id, str(e))
        logger.warning("Rate limited for %s: %s", tpl_id, e)
        raise
    except Exception as e:
        _record_failure(tpl_id, str(e))
        logger.error("Failed to generate video for %s: %s", tpl_id, e)
        return False


async def video_gen_loop(stop: asyncio.Event) -> None:
    settings = get_settings()
    if not settings.template_video_gen_enabled:
        return
    logger.info(
        "Template video generator started (interval=%ss, pending=%s)",
        settings.template_video_gen_interval_seconds,
        count_video_progress().get("videos_pending"),
    )
    while not stop.is_set():
        try:
            tpl = await asyncio.to_thread(get_pending_template)
            if not tpl:
                try:
                    await asyncio.wait_for(stop.wait(), timeout=300)
                except asyncio.TimeoutError:
                    pass
                continue

            try:
                await asyncio.to_thread(generate_video_for_template, tpl)
            except SeedanceRateLimitError:
                wait_s = max(settings.seedance_rate_limit_wait_seconds, 60)
                try:
                    await asyncio.wait_for(stop.wait(), timeout=wait_s)
                except asyncio.TimeoutError:
                    pass
                continue
        except Exception:
            logger.exception("Video gen loop error")

        try:
            await asyncio.wait_for(
                stop.wait(), timeout=settings.template_video_gen_interval_seconds
            )
        except asyncio.TimeoutError:
            continue
    logger.info("Template video generator stopped")
