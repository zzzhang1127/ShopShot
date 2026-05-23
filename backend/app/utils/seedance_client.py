import time
import threading
import requests
from app.config import get_settings

settings = get_settings()


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

        resp = requests.post(
            f"{self.base_url}/contents/generations/tasks",
            json=body,
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    def query_task(self, task_id: str) -> dict:
        resp = requests.get(
            f"{self.base_url}/contents/generations/tasks/{task_id}",
            headers=self._headers(),
        )
        resp.raise_for_status()
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
        max_retry: int = 3,
    ) -> str:
        with self.semaphore:
            for attempt in range(max_retry):
                try:
                    submit_resp = self.submit_task(
                        prompt, first_frame, last_frame, duration, ratio, resolution, fps
                    )
                    task_id = submit_resp["id"]

                    while True:
                        result = self.query_task(task_id)
                        status = result.get("status")
                        if status == "succeeded":
                            return result["content"]["video_url"]
                        elif status == "failed":
                            error = result.get("error", "unknown")
                            raise RuntimeError(f"Seedance task failed: {error}")
                        time.sleep(self.poll_interval)
                except Exception as e:
                    if attempt == max_retry - 1:
                        raise
                    time.sleep(2 ** attempt)


_seedance_client = None


def get_seedance_client() -> SeedanceClient:
    global _seedance_client
    if _seedance_client is None:
        _seedance_client = SeedanceClient()
    return _seedance_client
