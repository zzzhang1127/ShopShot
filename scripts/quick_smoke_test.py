import time
import requests

BASE = "http://127.0.0.1:8000/api/v1"


def wait_task(task_id: str, timeout_seconds: int = 900) -> dict:
    deadline = time.time() + timeout_seconds
    last: dict = {}
    while time.time() < deadline:
        status = requests.get(f"{BASE}/generations/{task_id}/status", timeout=30).json()["data"]
        last = status
        print("  poll", status.get("status"), status.get("progress"), status.get("step"), flush=True)
        if status.get("status") in ("succeeded", "failed"):
            return status
        time.sleep(2)
    raise TimeoutError(f"task timeout: {task_id}, last={last}")


def main():
    r = requests.post(
        f"{BASE}/projects",
        json={"name": "quick-test", "product_info": "红色高跟鞋测试"},
        timeout=30,
    )
    pid = r.json()["data"]["id"]
    print("project", pid, flush=True)

    t0 = time.time()
    script_task = requests.post(f"{BASE}/scripts/generate", json={"project_id": pid}, timeout=120).json()["data"]
    script_status = wait_task(script_task["id"])
    print("script", script_status.get("status"), f"{time.time() - t0:.1f}s", flush=True)
    if script_status.get("status") != "succeeded":
        print("script_error", script_status.get("error"), flush=True)
        return

    scripts = requests.get(f"{BASE}/scripts?project_id={pid}", timeout=30).json()["data"]
    if not scripts:
        print("scripts_empty", flush=True)
        return
    sid = scripts[0]["id"]
    shots = requests.get(f"{BASE}/shots?script_id={sid}", timeout=30).json()["data"]
    print("shots", len(shots), flush=True)

    t1 = time.time()
    video_task = requests.post(f"{BASE}/agents/run/{pid}/video", timeout=120).json()["data"]
    video_status = wait_task(video_task["id"])
    print(
        "video",
        video_status.get("status"),
        f"{time.time() - t1:.1f}s",
        video_status.get("error"),
        flush=True,
    )
    videos = requests.get(f"{BASE}/videos?project_id={pid}", timeout=30).json()["data"]
    print("videos", len(videos), flush=True)


if __name__ == "__main__":
    main()
