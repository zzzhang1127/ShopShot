import time
from typing import Any

import requests

from app.config import get_settings

settings = get_settings()


class ComfyUIError(RuntimeError):
    pass


class ComfyUIClient:
    def __init__(self) -> None:
        self.enabled = bool(settings.comfyui_enabled)
        self.base_url = (settings.comfyui_url or "").rstrip("/")
        self.poll_interval = max(settings.comfyui_poll_interval, 0.5)
        self.timeout_seconds = max(settings.comfyui_timeout_seconds, 10)
        self.api_key = settings.comfyui_api_key or ""

    @property
    def configured(self) -> bool:
        return self.enabled and bool(self.base_url)

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def health(self) -> tuple[bool, str]:
        if not self.enabled:
            return False, "ComfyUI 未启用（COMFYUI_ENABLED=false）"
        if not self.base_url:
            return False, "ComfyUI 未配置 URL（COMFYUI_URL 为空）"
        try:
            resp = requests.get(
                f"{self.base_url}/system_stats",
                headers=self._headers(),
                timeout=8,
            )
            if resp.status_code >= 400:
                return False, f"ComfyUI 返回 HTTP {resp.status_code}"
            return True, "ComfyUI 可用"
        except Exception as exc:  # noqa: BLE001
            return False, f"ComfyUI 不可达: {exc}"

    def execute(self, workflow: dict[str, Any]) -> tuple[str, bytes, str, str]:
        if not self.enabled:
            raise ComfyUIError("ComfyUI 功能未启用。请在 .env 设置 COMFYUI_ENABLED=true。")
        if not self.base_url:
            raise ComfyUIError("ComfyUI URL 未配置。请在 .env 设置 COMFYUI_URL。")
        if not workflow:
            raise ComfyUIError("workflow 为空，无法执行。")

        submit = requests.post(
            f"{self.base_url}/prompt",
            json={"prompt": workflow},
            headers=self._headers(),
            timeout=30,
        )
        if submit.status_code >= 400:
            raise ComfyUIError(f"ComfyUI submit 失败 ({submit.status_code}): {submit.text[:500]}")
        submit_data = submit.json()
        prompt_id = submit_data.get("prompt_id")
        if not prompt_id:
            raise ComfyUIError(f"ComfyUI 未返回 prompt_id: {submit_data}")

        deadline = time.time() + self.timeout_seconds
        while time.time() < deadline:
            hist = requests.get(
                f"{self.base_url}/history/{prompt_id}",
                headers=self._headers(),
                timeout=20,
            )
            if hist.status_code >= 400:
                raise ComfyUIError(f"ComfyUI history 查询失败 ({hist.status_code}): {hist.text[:500]}")
            payload = hist.json() or {}
            task = payload.get(prompt_id) or payload.get(str(prompt_id))
            if not task:
                time.sleep(self.poll_interval)
                continue

            outputs = task.get("outputs", {})
            selected = self._pick_output(outputs)
            if selected is None:
                # 任务可能还未写出 outputs
                time.sleep(self.poll_interval)
                continue

            kind, node = selected
            data = self._download_output(node)
            filename = str(node.get("filename", "comfy_output.bin"))
            return prompt_id, data, filename, kind

        raise ComfyUIError(f"ComfyUI 执行超时（>{self.timeout_seconds}s）")

    def _pick_output(self, outputs: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
        # 优先图像 > 视频 > 音频
        preferred = ("images", "videos", "gifs", "audio")
        for node in outputs.values():
            if not isinstance(node, dict):
                continue
            for key in preferred:
                items = node.get(key)
                if isinstance(items, list) and items:
                    kind = "video" if key in ("videos", "gifs") else ("audio" if key == "audio" else "image")
                    first = items[0]
                    if isinstance(first, dict):
                        return kind, first
        return None

    def _download_output(self, node: dict[str, Any]) -> bytes:
        filename = node.get("filename")
        if not filename:
            raise ComfyUIError(f"输出节点缺少 filename: {node}")
        subfolder = node.get("subfolder", "")
        type_name = node.get("type", "output")
        resp = requests.get(
            f"{self.base_url}/view",
            params={"filename": filename, "subfolder": subfolder, "type": type_name},
            headers=self._headers(),
            timeout=60,
        )
        if resp.status_code >= 400:
            raise ComfyUIError(f"下载 ComfyUI 输出失败 ({resp.status_code}): {resp.text[:300]}")
        return resp.content


_client: ComfyUIClient | None = None


def get_comfyui_client() -> ComfyUIClient:
    global _client
    if _client is None:
        _client = ComfyUIClient()
    return _client
