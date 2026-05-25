import json
import time
import threading
import requests
from app.config import get_settings

settings = get_settings()

# 全进程共享：避免多镜/多任务瞬间打满账号 RPM
_submit_lock = threading.Lock()
_last_submit_at = 0.0


class SeedanceRateLimitError(RuntimeError):
    """火山方舟 Seedance 账号 RPM / 并发超限。"""


def _parse_error_body(text: str) -> dict:
    try:
        data = json.loads(text)
        return data.get("error", data) if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def _is_rate_limit(status_code: int, body_text: str) -> bool:
    if status_code == 429:
        return True
    err = _parse_error_body(body_text)
    code = str(err.get("code", "")).lower()
    return "ratelimit" in code or "rpm" in code or "toomanyrequests" in code


def _friendly_rate_limit_message() -> str:
    return (
        "火山方舟 Seedance 账号每分钟请求数（RPM）已达上限。"
        f"请等待约 {max(settings.seedance_rate_limit_wait_seconds, 30)} 秒后重试。"
        "深度模式会连续生成多个分镜，请勿同时开启多个项目的视频生成。"
    )


class SeedanceClient:
    def __init__(self):
        self.api_key = settings.volc_api_key
        self.base_url = settings.volc_base_url.rstrip("/")
        self.model = settings.doubao_seedance_ep
        self.concurrency = settings.seedance_concurrency
        self.poll_interval = settings.seedance_poll_interval
        self.semaphore = threading.Semaphore(self.concurrency)

    def _headers(self):
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

    def _wait_submit_slot(self):
        """两次 submit 之间保持最小间隔，降低 RPM 触发概率。"""
        global _last_submit_at
        interval = max(settings.seedance_min_submit_interval, 1)
        with _submit_lock:
            now = time.time()
            wait = interval - (now - _last_submit_at)
            if wait > 0:
                time.sleep(wait)
            _last_submit_at = time.time()

    def submit_task(
        self,
        prompt: str,
        first_frame: str = None,
        last_frame: str = None,
        duration: int = None,
        ratio: str = None,
        resolution: str = None,
        fps: int = None,
    ) -> dict:
        duration = duration or settings.seedance_default_duration
        resolution = resolution or settings.seedance_default_resolution
        ratio = ratio or settings.seedance_default_ratio
        fps = fps or settings.seedance_default_fps
        cmd = f" --rs {resolution} --rt {ratio} --fps {fps}"
        if not settings.seedance_watermark:
            cmd += " --wm false"
        prompt_with_cmd = prompt.strip() + cmd

        content = [{"type": "text", "text": prompt_with_cmd}]
        if first_frame:
            content.append({"type": "image_url", "image_url": {"url": first_frame}})
        if last_frame:
            content.append({"type": "image_url", "image_url": {"url": last_frame}, "role": "last_frame"})

        body = {
            "model": self.model,
            "content": content,
            "duration": duration,
        }

        self._wait_submit_slot()
        resp = requests.post(
            f"{self.base_url}/contents/generations/tasks",
            json=body,
            headers=self._headers(),
            timeout=120,
        )
        if resp.status_code >= 400:
            body_text = resp.text[:1000]
            if _is_rate_limit(resp.status_code, body_text):
                raise SeedanceRateLimitError(_friendly_rate_limit_message())
            raise RuntimeError(f"Seedance submit failed ({resp.status_code}): {body_text}")
        return resp.json()

    def query_task(self, task_id: str) -> dict:
        resp = requests.get(
            f"{self.base_url}/contents/generations/tasks/{task_id}",
            headers=self._headers(),
            timeout=60,
        )
        if resp.status_code >= 400:
            body_text = resp.text[:1000]
            if _is_rate_limit(resp.status_code, body_text):
                raise SeedanceRateLimitError(_friendly_rate_limit_message())
            raise RuntimeError(f"Seedance query failed ({resp.status_code}): {body_text}")
        return resp.json()

    def generate(
        self,
        prompt: str,
        first_frame: str = None,
        last_frame: str = None,
        duration: int = None,
        ratio: str = None,
        resolution: str = None,
        fps: int = None,
        max_retry: int | None = None,
        on_poll=None,
    ) -> str:
        if settings.mock_mode:
            raise RuntimeError(
                "MOCK_MODE 已关闭：请在项目根目录 .env 设置 MOCK_MODE=false 并使用真实 Seedance API"
            )

        max_retry = max_retry or settings.seedance_max_retry
        with self.semaphore:
            for attempt in range(max_retry):
                try:
                    submit_resp = self.submit_task(
                        prompt, first_frame, last_frame, duration, ratio, resolution, fps
                    )
                    task_id = submit_resp["id"]
                    if on_poll:
                        on_poll(5, "queued")

                    poll_count = 0
                    while True:
                        result = self.query_task(task_id)
                        status = result.get("status")
                        if on_poll:
                            if status == "queued":
                                sub = min(15 + poll_count * 2, 35)
                            elif status == "running":
                                sub = min(40 + poll_count * 3, 92)
                            else:
                                sub = 95
                            on_poll(sub, status or "running")
                            poll_count += 1
                        if status == "succeeded":
                            if on_poll:
                                on_poll(100, "succeeded")
                            video_url = result.get("content", {}).get("video_url")
                            if not video_url or not str(video_url).startswith("http"):
                                raise RuntimeError(
                                    f"Seedance 成功但未返回有效 video_url: {result!r}"
                                )
                            return video_url
                        if status == "failed":
                            error = result.get("error", "unknown")
                            raise RuntimeError(f"Seedance task failed: {error}")
                        time.sleep(self.poll_interval)
                except SeedanceRateLimitError:
                    if attempt >= max_retry - 1:
                        raise
                    wait_s = settings.seedance_rate_limit_wait_seconds * (attempt + 1)
                    if on_poll:
                        on_poll(min(5 + attempt * 5, 20), "rate_limit_retry")
                    time.sleep(wait_s)
                except Exception:
                    if attempt >= max_retry - 1:
                        raise
                    time.sleep(2 ** attempt)

        raise RuntimeError("Seedance generate failed after retries")


_seedance_client = None


def get_seedance_client() -> SeedanceClient:
    global _seedance_client
    if _seedance_client is None:
        _seedance_client = SeedanceClient()
    return _seedance_client
