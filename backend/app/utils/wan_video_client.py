"""DashScope Wan video API (i2v/t2v) — optional fallback alongside Seedance."""
from __future__ import annotations

import time
from typing import Any

import requests

from app.config import get_settings

settings = get_settings()


class WanVideoError(RuntimeError):
    pass


class WanVideoClient:
    def __init__(self) -> None:
        self.api_key = settings.dashscope_api_key
        self.base_url = (settings.dashscope_base_url or "https://dashscope.aliyuncs.com/api/v1/").rstrip("/")
        self.model = settings.wan_video_model

    @property
    def configured(self) -> bool:
        return bool(settings.wan_video_enabled and self.api_key)

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "X-DashScope-Async": "enable",
        }

    def _poll_task(self, task_id: str, timeout: int = 600) -> str:
        url = f"{self.base_url}/tasks/{task_id}"
        deadline = time.time() + timeout
        while time.time() < deadline:
            resp = requests.get(url, headers={"Authorization": f"Bearer {self.api_key}"}, timeout=30)
            if resp.status_code >= 400:
                raise WanVideoError(resp.text[:300])
            data = resp.json()
            out = data.get("output", {})
            status = out.get("task_status", "")
            if status == "SUCCEEDED":
                video_url = out.get("video_url") or out.get("results", {}).get("video_url")
                if not video_url and isinstance(out.get("results"), list) and out["results"]:
                    video_url = out["results"][0].get("url")
                if video_url:
                    return str(video_url)
                raise WanVideoError(f"no video url in response: {out}")
            if status in ("FAILED", "CANCELLED"):
                raise WanVideoError(out.get("message", status))
            time.sleep(5)
        raise WanVideoError("wan video task timeout")

    def generate_i2v(
        self,
        prompt: str,
        image_url: str,
        *,
        duration: int = 5,
        resolution: str = "720P",
    ) -> str:
        if not self.configured:
            raise WanVideoError("Wan video not configured")
        payload: dict[str, Any] = {
            "model": self.model,
            "input": {"prompt": prompt, "img_url": image_url},
            "parameters": {"duration": duration, "resolution": resolution},
        }
        api_url = f"{self.base_url}/services/aigc/video-generation/video-synthesis"
        resp = requests.post(api_url, headers=self._headers(), json=payload, timeout=60)
        if resp.status_code >= 400:
            raise WanVideoError(f"submit ({resp.status_code}): {resp.text[:400]}")
        body = resp.json()
        task_id = body.get("output", {}).get("task_id") or body.get("task_id")
        if not task_id:
            raise WanVideoError(f"no task_id: {body}")
        return self._poll_task(task_id)


_client: WanVideoClient | None = None


def get_wan_video_client() -> WanVideoClient:
    global _client
    if _client is None:
        _client = WanVideoClient()
    return _client
