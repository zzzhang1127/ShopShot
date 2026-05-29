"""
Feature matrix smoke test for ShopShot core APIs.

Usage:
  python scripts/feature_matrix_smoke.py
  python scripts/feature_matrix_smoke.py --with-video
"""

from __future__ import annotations

import argparse
import io
import sys
import time
from pathlib import Path
from typing import Any

import requests

DEFAULT_BASE = "http://127.0.0.1:8000/api/v1"
BASE = DEFAULT_BASE


def api_get(path: str, **kwargs) -> dict[str, Any]:
    r = requests.get(f"{BASE}{path}", timeout=60, **kwargs)
    if r.status_code >= 400:
        raise RuntimeError(f"GET {path} failed: {r.status_code} {r.text[:300]}")
    return r.json()


def api_post(path: str, **kwargs) -> dict[str, Any]:
    r = requests.post(f"{BASE}{path}", timeout=60, **kwargs)
    if r.status_code >= 400:
        raise RuntimeError(f"POST {path} failed: {r.status_code} {r.text[:300]}")
    return r.json()


def wait_task(task_id: str, timeout_seconds: int = 900) -> dict[str, Any]:
    deadline = time.time() + timeout_seconds
    last: dict[str, Any] = {}
    while time.time() < deadline:
        data = api_get(f"/generations/{task_id}/status")["data"]
        last = data
        print(
            f"  poll status={data.get('status')} progress={data.get('progress')} step={data.get('step')}",
            flush=True,
        )
        if data.get("status") in ("succeeded", "failed"):
            return data
        time.sleep(2)
    raise TimeoutError(f"task timeout: {task_id}, last={last}")


def tiny_png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc``\x00\x00\x00\x02\x00\x01\xe5\x27\xde\xfc\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def tiny_mp3_like() -> bytes:
    # Enough for upload endpoint smoke; this is not a playable file.
    return b"ID3\x04\x00\x00\x00\x00\x00\x15TIT2\x00\x00\x00\x05\x00\x00test"


def tiny_mp4_like() -> bytes:
    # Enough for upload endpoint smoke; this is not a playable file.
    return b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom"


def real_image_for_video() -> tuple[str, bytes, str] | None:
    root = Path(__file__).resolve().parents[1] / "datasets" / "eval"
    for ext, mime in (("*.jpg", "image/jpeg"), ("*.jpeg", "image/jpeg"), ("*.png", "image/png")):
        hit = next(root.glob(ext), None)
        if hit and hit.is_file():
            return hit.name, hit.read_bytes(), mime
    return None


def real_audio_for_bgm() -> tuple[str, bytes, str] | None:
    root = Path(__file__).resolve().parents[1] / "datasets" / "eval"
    for ext, mime in (("*.mp3", "audio/mpeg"), ("*.wav", "audio/wav"), ("*.m4a", "audio/mp4")):
        hit = next(root.glob(ext), None)
        if hit and hit.is_file():
            return hit.name, hit.read_bytes(), mime
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--with-video", action="store_true", help="also run video generation task")
    parser.add_argument("--base", default=DEFAULT_BASE, help="API base, e.g. http://127.0.0.1:8000/api/v1")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    globals()["BASE"] = base

    print("=== Feature matrix smoke ===", flush=True)
    health = requests.get(f"{base}/health", timeout=8).json()
    print("health:", health, flush=True)

    created = api_post(
        "/projects",
        json={
            "name": "feature-matrix-smoke",
            "description": "automated feature smoke",
            "product_info": "红色高跟鞋，轻便舒适，适合通勤与派对。",
            "video_mode": "product_show",
        },
    )["data"]
    project_id = created["id"]
    print("project_id:", project_id, flush=True)

    # Upload image/audio/video material with different source tags.
    image_payload = ("sample.png", tiny_png(), "image/png")
    if args.with_video:
        real_image = real_image_for_video()
        if real_image:
            image_payload = real_image

    up_img = api_post(
        f"/upload?project_id={project_id}&source=upload",
        files={"file": (image_payload[0], io.BytesIO(image_payload[1]), image_payload[2])},
    )["data"]
    bgm_payload: tuple[str, bytes, str] | None = ("bgm.mp3", tiny_mp3_like(), "audio/mpeg")
    if args.with_video:
        bgm_payload = real_audio_for_bgm()

    up_bgm = None
    if bgm_payload:
        up_bgm = api_post(
            f"/upload?project_id={project_id}&source=bgm",
            files={"file": (bgm_payload[0], io.BytesIO(bgm_payload[1]), bgm_payload[2])},
        )["data"]
    up_vid = api_post(
        f"/upload?project_id={project_id}&source=upload",
        files={"file": ("sample.mp4", io.BytesIO(tiny_mp4_like()), "video/mp4")},
    )["data"]
    print(
        "uploaded:",
        up_img["id"],
        up_bgm["id"] if up_bgm else "bgm-skipped",
        up_vid["id"],
        flush=True,
    )

    all_assets = api_get(f"/assets?project_id={project_id}")["data"]["items"]
    bgm_assets = api_get(f"/assets?project_id={project_id}&source=bgm")["data"]["items"]
    print("assets_count:", len(all_assets), "bgm_count:", len(bgm_assets), flush=True)

    comfy_health = api_get("/comfy/health")["data"]
    comfy_workflows = api_get("/comfy/workflows")["data"]
    print("comfy_health:", comfy_health, flush=True)
    print("comfy_workflows:", len(comfy_workflows), flush=True)

    # Newly added resource discovery endpoints.
    resource_templates = api_get("/resources/templates")["data"]
    resource_workflows = api_get("/resources/workflows")["data"]
    resource_bgm = api_get("/resources/bgm")["data"]
    print(
        "resources templates/workflows/bgm:",
        len(resource_templates),
        len(resource_workflows),
        len(resource_bgm),
        flush=True,
    )

    lib_assets = api_get("/library/assets?limit=20")["data"]["items"]
    lib_scripts = api_get("/library/scripts?limit=20")["data"]["items"]
    lib_videos = api_get("/library/videos?limit=20")["data"]["items"]
    proj_map = api_get("/library/projects-map")["data"]
    print(
        "library assets/scripts/videos:",
        len(lib_assets),
        len(lib_scripts),
        len(lib_videos),
        "projects",
        len(proj_map),
        flush=True,
    )

    script_task = api_post("/scripts/generate", json={"project_id": project_id})["data"]
    script_result = wait_task(script_task["id"])
    if script_result.get("status") != "succeeded":
        print("script failed:", script_result.get("error"), flush=True)
        return 2

    scripts = api_get(f"/scripts?project_id={project_id}")["data"]
    if not scripts:
        print("scripts empty after succeeded task", flush=True)
        return 3
    script_id = scripts[0]["id"]
    shots = api_get(f"/shots?script_id={script_id}")["data"]
    print("scripts/shots:", len(scripts), len(shots), flush=True)

    # Delete script API smoke.
    deleted = requests.delete(f"{BASE}/scripts/{script_id}", timeout=30).json()
    print("delete_script:", deleted.get("success"), flush=True)
    scripts_after_delete = api_get(f"/scripts?project_id={project_id}")["data"]
    print("scripts_after_delete:", len(scripts_after_delete), flush=True)

    if args.with_video:
        # Recreate script for video generation.
        script_task = api_post("/scripts/generate", json={"project_id": project_id})["data"]
        script_result = wait_task(script_task["id"])
        if script_result.get("status") != "succeeded":
            print("script failed before video:", script_result.get("error"), flush=True)
            return 4
        video_task = api_post(
            f"/agents/run/{project_id}/video",
            json={"target_ratio": "9:16", "duration": 20, "pipeline_preset": "asset_based"},
        )["data"]
        video_result = wait_task(video_task["id"])
        print("video_result:", video_result.get("status"), video_result.get("error"), flush=True)
        videos = api_get(f"/videos?project_id={project_id}")["data"]
        print("videos_count:", len(videos), flush=True)
        if video_result.get("status") != "succeeded":
            return 5

    print("FEATURE_SMOKE_OK", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
