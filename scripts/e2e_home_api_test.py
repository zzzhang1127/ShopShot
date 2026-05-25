"""
首页（HomePage）可点击操作 → 后端 API 映射自动化测试。

用法（先启动后端 http://127.0.0.1:8000）:
  python scripts/e2e_home_api_test.py

覆盖：创建项目、列表、上传素材、生成剧本、分镜列表、生成视频、成片列表。
"""
from __future__ import annotations

import io
import json
import sys
import time
from pathlib import Path

import requests

BASE = "http://127.0.0.1:8000/api/v1"
HEALTH = "http://127.0.0.1:8000/health"
ROOT = Path(__file__).resolve().parents[1]


def ok(name: str, cond: bool, detail: str = ""):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))
    return cond


def get(path: str, **kwargs):
    r = requests.get(f"{BASE}{path}", timeout=120, **kwargs)
    r.raise_for_status()
    return r.json()


def post(path: str, **kwargs):
    r = requests.post(f"{BASE}{path}", timeout=60, **kwargs)
    if r.status_code >= 400:
        print(r.text[:800])
    r.raise_for_status()
    return r.json()


def wait_task(task_id: str, timeout: int = 900) -> dict:
    """轮询直到任务结束（真实 API 可能较慢）。"""
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        data = get(f"/generations/{task_id}/status")["data"]
        last = data
        st = data.get("status")
        prog = data.get("progress", 0)
        step = data.get("step", "")
        print(f"  … {st} {prog}% {step}")
        if st in ("succeeded", "failed"):
            return data
        time.sleep(2)
    raise TimeoutError(f"Task {task_id} timeout, last={last}")


def main() -> int:
    print("=== ShopShot 首页 API 链路测试 ===\n")

    # 0. 健康检查
    try:
        h = requests.get(HEALTH, timeout=5).json()
        if not ok("后端健康检查 /health", h.get("status") == "ok", str(h)):
            return 1
    except Exception as e:
        ok("后端健康检查 /health", False, f"请先运行 start_backend.bat: {e}")
        return 1

    results: list[bool] = []

    # 1. 首页「生成」→ POST /projects
    body = post(
        "/projects",
        json={
            "name": "E2E测试-红色高跟鞋",
            "description": "https://example.com/product/demo",
            "product_info": "红色高跟鞋，适合派对与通勤，柔软鞋垫，限时优惠",
            "video_mode": "product_show",
        },
    )
    project = body["data"]
    pid = project["id"]
    results.append(ok("首页生成/创建项目 POST /projects", bool(pid), f"id={pid}"))

    # 2. 首页「项目」导航 → GET /projects
    listed = get("/projects")
    items = listed["data"]["items"]
    results.append(
        ok(
            "首页项目列表 GET /projects",
            any(p["id"] == pid for p in items),
            f"count={len(items)}",
        )
    )

    # 3. 首页「上传图片」→ POST /upload
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc``\x00\x00\x00\x02\x00\x01\xe5\x27\xde\xfc\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    files = {"file": ("e2e_product.png", io.BytesIO(png), "image/png")}
    up = post(f"/upload?project_id={pid}", files=files)
    asset_id = up["data"]["id"]
    results.append(ok("首页上传素材 POST /upload", bool(asset_id), f"asset_id={asset_id}"))

    # 4. 项目页「生成剧本」→ POST /scripts/generate
    t0 = time.time()
    script_task = post("/scripts/generate", json={"project_id": pid})
    task = script_task["data"]
    task = wait_task(task["id"])
    results.append(
        ok(
            "生成剧本 POST /scripts/generate",
            task.get("status") == "succeeded",
            f"status={task.get('status')} step={task.get('step')}",
        )
    )

    scripts = get(f"/scripts?project_id={pid}")["data"]
    results.append(ok("剧本列表 GET /scripts", len(scripts) >= 1, f"scripts={len(scripts)}"))
    script_id = scripts[0]["id"]

    # 5. 分镜 → GET /shots
    shots = get(f"/shots?script_id={script_id}")["data"]
    results.append(ok("分镜列表 GET /shots", len(shots) >= 1, f"shots={len(shots)}"))
    if shots:
        sample = shots[0]
        results.append(
            ok(
                "分镜字段完整",
                bool(sample.get("shot_id")) and bool(sample.get("action_prompt") or sample.get("image_prompt")),
                f"shot_id={sample.get('shot_id')}",
            )
        )

    # 6. 生成视频 → POST /agents/run/{id}/video
    print(f"\n--- 视频生成（真实 Seedance API）---")
    vid_task_body = post(f"/agents/run/{pid}/video")
    vid_task = wait_task(vid_task_body["data"]["id"])
    results.append(
        ok(
            "生成视频 POST /agents/run/{id}/video",
            vid_task.get("status") == "succeeded",
            f"status={vid_task.get('status')} elapsed={time.time()-t0:.1f}s error={vid_task.get('error')}",
        )
    )

    videos = get(f"/videos?project_id={pid}")["data"]
    results.append(ok("成片列表 GET /videos", len(videos) >= 1, f"videos={len(videos)}"))

    # 7. 快捷模式 → POST /agents/run/{id}/quick
    quick = post(
        f"/agents/run/{pid}/quick",
        json={
            "project_id": pid,
            "prompt": "红色高跟鞋特写，缓慢推镜头，电商广告风格",
            "target_ratio": "9:16",
        },
    )
    qtask = wait_task(quick["data"]["id"])
    results.append(
        ok(
            "首页快捷成片 POST /agents/run/{id}/quick",
            qtask.get("status") == "succeeded",
            f"status={qtask.get('status')}",
        )
    )

    passed = sum(results)
    total = len(results)
    print(f"\n=== 结果: {passed}/{total} 通过 ===")
    if passed < total:
        return 1
    print("\n剧本 → 分镜 → 视频 链路已跑通。可打开 http://localhost:5173 体验前端。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
