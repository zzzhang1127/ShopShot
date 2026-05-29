"""DashScope Wan2.7 image API (from Wan-skills wan2.7-image-skill)."""
from __future__ import annotations

import time
from typing import Any

import requests

from app.config import get_settings

settings = get_settings()


class WanImageError(RuntimeError):
    pass


class WanImageClient:
    def __init__(self) -> None:
        self.api_key = settings.dashscope_api_key
        self.base_url = (settings.dashscope_base_url or "https://dashscope.aliyuncs.com/api/v1/").rstrip("/")
        self.model = settings.wan_image_model

    @property
    def configured(self) -> bool:
        return bool(settings.wan_image_enabled and self.api_key)

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "X-DashScope-Async": "enable",
            "X-DashScope-OssResourceResolve": "enable",
        }

    def _poll_task(self, task_id: str, timeout: int = 120) -> list[dict[str, Any]]:
        url = f"{self.base_url}/tasks/{task_id}"
        deadline = time.time() + timeout
        while time.time() < deadline:
            resp = requests.get(url, headers={"Authorization": f"Bearer {self.api_key}"}, timeout=30)
            if resp.status_code >= 400:
                raise WanImageError(f"poll failed: {resp.text[:300]}")
            data = resp.json()
            status = data.get("output", {}).get("task_status", "")
            if status == "SUCCEEDED":
                msg = data.get("output", {}).get("choices", [{}])[0].get("message", {})
                content = msg.get("content") if isinstance(msg, dict) else None
                if isinstance(content, list):
                    return content
                raise WanImageError("no image in wan response")
            if status in ("FAILED", "CANCELLED"):
                raise WanImageError(data.get("output", {}).get("message", status))
            time.sleep(3)
        raise WanImageError("wan image task timeout")

    def generate(
        self,
        prompt: str,
        *,
        image_urls: list[str] | None = None,
        size: str = "1280*720",
        n: int = 1,
    ) -> list[str]:
        if not self.configured:
            raise WanImageError("Wan image not configured (WAN_IMAGE_ENABLED + DASHSCOPE_API_KEY)")

        content: list[dict[str, Any]] = [{"text": prompt}]
        for url in image_urls or []:
            content.append({"image": url})

        payload = {
            "model": self.model,
            "input": {"messages": [{"role": "user", "content": content}]},
            "parameters": {
                "negative_prompt": "",
                "prompt_extend": True,
                "watermark": False,
                "n": n,
                "size": size,
                "enable_sequential": False,
            },
        }
        api_url = f"{self.base_url}/services/aigc/image-generation/generation"
        resp = requests.post(api_url, headers=self._headers(), json=payload, timeout=60)
        if resp.status_code >= 400:
            raise WanImageError(f"submit failed ({resp.status_code}): {resp.text[:400]}")
        body = resp.json()
        task_id = body.get("output", {}).get("task_id") or body.get("task_id")
        if not task_id:
            raise WanImageError(f"no task_id: {body}")
        items = self._poll_task(task_id)
        urls: list[str] = []
        for item in items:
            if isinstance(item, dict) and item.get("image"):
                urls.append(str(item["image"]))
        if not urls:
            raise WanImageError("empty image urls")
        return urls


_client: WanImageClient | None = None


def get_wan_image_client() -> WanImageClient:
    global _client
    if _client is None:
        _client = WanImageClient()
    return _client
