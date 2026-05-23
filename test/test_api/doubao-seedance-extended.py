"""
Doubao-Seedance-1.5-pro 扩展能力测试

基于官方文档，补充测试以下未覆盖能力：
  - 首尾帧图生视频
  - 返回尾帧图 (return_last_frame)
  - 随机种子 (seed)
  - 更多画面比例 (1:1, 4:3, 21:9)
  - 图生视频 + 有声 (generate_audio)

环境变量来自项目根目录 .env 文件。
"""

import os
import sys
import json
import base64
import time
import requests
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# 加载项目根目录的 .env
PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

# 配置
BASE_URL = os.getenv("VOLC_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
API_KEY = os.getenv("VOLC_API_KEY")
MODEL_ID = os.getenv("DOUBAO_SEEDANCE_EP")

EVAL_DIR = PROJECT_ROOT / "datasets" / "eval"
OUTPUT_DIR = PROJECT_ROOT / "outputs" / "api_results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

if not API_KEY:
    print("[ERROR] VOLC_API_KEY 未在 .env 中配置")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

_last_raw_response = None


def set_last_raw(response_data: dict):
    global _last_raw_response
    _last_raw_response = response_data


def save_response(test_name: str, response_data: dict):
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    out_path = OUTPUT_DIR / f"seedance_{test_name}_{timestamp}.json"
    payload = {
        "parsed": response_data,
        "raw_response": _last_raw_response,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"  结果已保存: {out_path}")


def encode_image(image_path: Path) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def download_media(url: str, save_path: Path) -> bool:
    try:
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()
        with open(save_path, "wb") as f:
            f.write(resp.content)
        print(f"  媒体已下载: {save_path} ({len(resp.content)} bytes)")
        return True
    except Exception as e:
        print(f"  [DOWNLOAD FAIL] {e}")
        return False


def create_task(payload: dict) -> dict:
    url = f"{BASE_URL}/contents/generations/tasks"
    resp = requests.post(url, headers=HEADERS, json=payload, timeout=30)
    resp.raise_for_status()
    return resp.json()


def get_task(task_id: str) -> dict:
    url = f"{BASE_URL}/contents/generations/tasks/{task_id}"
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


def poll_and_download(task_id: str, save_prefix: str, max_wait: int = 300, download: bool = True) -> dict:
    print(f"  任务已创建: {task_id}，开始轮询...")
    start = time.time()
    while time.time() - start < max_wait:
        data = get_task(task_id)
        status = data.get("status", "unknown")
        print(f"    [{time.strftime('%H:%M:%S')}] status={status}")

        if status == "succeeded":
            video_url = data.get("content", {}).get("video_url")
            last_frame_url = data.get("content", {}).get("last_frame_url")
            print(f"    [SUCCESS] 视频生成完成")
            print(f"    视频 URL: {video_url}")
            if last_frame_url:
                print(f"    尾帧 URL: {last_frame_url}")
            result = {
                "status": status,
                "video_url": video_url,
                "last_frame_url": last_frame_url,
                "usage": data.get("usage"),
            }
            if download and video_url:
                ext = ".mp4"
                save_path = OUTPUT_DIR / f"{save_prefix}_{time.strftime('%H%M%S')}{ext}"
                success = download_media(video_url, save_path)
                result["download_success"] = success
                result["local_path"] = str(save_path) if success else None
                if last_frame_url:
                    lf_path = OUTPUT_DIR / f"{save_prefix}_lastframe_{time.strftime('%H%M%S')}.png"
                    lf_success = download_media(last_frame_url, lf_path)
                    result["last_frame_download_success"] = lf_success
                    result["last_frame_local_path"] = str(lf_path) if lf_success else None
            set_last_raw(data)
            return result

        if status == "failed":
            print(f"    [FAIL] 任务失败: {data.get('error')}")
            set_last_raw(data)
            return {"status": status, "error": data.get("error")}

        time.sleep(5)

    print(f"  [TIMEOUT] 超过 {max_wait}s 未获取到结果")
    return {"status": "timeout", "task_id": task_id}


def test_07_first_last_frame():
    """测试 7：首尾帧图生视频"""
    print("\n[TEST 07] 首尾帧图生视频")
    image_path = EVAL_DIR / "微信图片_20260221134938_6_1.jpg"
    if not image_path.exists():
        print(f"  [SKIP] 图片不存在: {image_path}")
        return

    try:
        b64 = encode_image(image_path)
        payload = {
            "model": MODEL_ID,
            "content": [
                {
                    "type": "text",
                    "text": "360度环绕运镜，展示商品从不同角度的细节",
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    "role": "first_frame",
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    "role": "last_frame",
                },
            ],
            "ratio": "adaptive",
            "duration": 5,
            "generate_audio": False,
            "watermark": False,
        }
        data = create_task(payload)
        set_last_raw(data)
        task_id = data.get("id")
        if not task_id:
            print(f"  [FAIL] 创建任务未返回 task_id")
            save_response("07_first_last_frame", {"error": "no task_id", "response": data})
            return

        result = poll_and_download(task_id, "seedance_07_firstlast")
        result["input_modality"] = "text+image_first_last"
        save_response("07_first_last_frame", result)
    except Exception as e:
        print(f"  [FAIL] {e}")
        save_response("07_first_last_frame", {"error": str(e)})


def test_08_return_last_frame():
    """测试 8：返回尾帧图"""
    print("\n[TEST 08] 返回尾帧图")
    try:
        payload = {
            "model": MODEL_ID,
            "content": [
                {"type": "text", "text": "一支口红在白色背景上缓慢旋转展示"}
            ],
            "ratio": "adaptive",
            "duration": 5,
            "return_last_frame": True,
            "watermark": False,
        }
        data = create_task(payload)
        set_last_raw(data)
        task_id = data.get("id")
        if not task_id:
            print(f"  [FAIL] 无 task_id")
            save_response("08_return_last_frame", {"error": "no task_id"})
            return

        result = poll_and_download(task_id, "seedance_08_lastframe")
        result["tested_feature"] = "return_last_frame"
        save_response("08_return_last_frame", result)
    except Exception as e:
        print(f"  [FAIL] {e}")
        save_response("08_return_last_frame", {"error": str(e)})


def test_09_seed():
    """测试 9：指定随机种子"""
    print("\n[TEST 09] 指定随机种子")
    try:
        payload = {
            "model": MODEL_ID,
            "content": [
                {"type": "text", "text": "一款高端护肤品在柔和光线下展示"}
            ],
            "ratio": "adaptive",
            "duration": 5,
            "seed": 42,
            "watermark": False,
        }
        data = create_task(payload)
        set_last_raw(data)
        task_id = data.get("id")
        if not task_id:
            print(f"  [FAIL] 无 task_id")
            save_response("09_seed", {"error": "no task_id"})
            return

        result = poll_and_download(task_id, "seedance_09_seed")
        result["seed"] = 42
        save_response("09_seed", result)
    except Exception as e:
        print(f"  [FAIL] {e}")
        save_response("09_seed", {"error": str(e)})


def test_10_more_ratios():
    """测试 10：更多画面比例（并行提交）"""
    print("\n[TEST 10] 更多画面比例")
    prompt = "一款香水在奢华背景下的产品展示，镜头缓慢推进"

    ratios = [
        {"desc": "正方形_1:1", "ratio": "1:1", "resolution": "720p"},
        {"desc": "横版_4:3", "ratio": "4:3", "resolution": "720p"},
        {"desc": "超宽屏_21:9", "ratio": "21:9", "resolution": "720p"},
    ]

    task_entries = []
    for idx, cfg in enumerate(ratios):
        print(f"  [Submit {idx+1}/3] {cfg['desc']}")
        try:
            payload = {
                "model": MODEL_ID,
                "content": [{"type": "text", "text": prompt}],
                "ratio": cfg["ratio"],
                "resolution": cfg["resolution"],
                "duration": 5,
                "generate_audio": False,
                "watermark": False,
            }
            data = create_task(payload)
            tid = data.get("id")
            if tid:
                task_entries.append((idx, tid, cfg))
                print(f"    task_id: {tid}")
            else:
                print(f"    [FAIL] 无 task_id")
        except Exception as e:
            print(f"    [FAIL] {e}")
        time.sleep(1)

    results = []
    for idx, tid, cfg in task_entries:
        print(f"\n  [Poll {idx+1}] {cfg['desc']}...")
        res = poll_and_download(tid, f"seedance_10_ratio_{cfg['desc']}", max_wait=180)
        res["ratio_config"] = cfg
        results.append(res)

    save_response("10_more_ratios", {"results": results})


def test_11_image_to_video_with_audio():
    """测试 11：图生视频 + 生成音频"""
    print("\n[TEST 11] 图生视频(有声)")
    image_path = EVAL_DIR / "微信图片_20260221134938_6_1.jpg"
    if not image_path.exists():
        print(f"  [SKIP] 图片不存在: {image_path}")
        return

    try:
        b64 = encode_image(image_path)
        payload = {
            "model": MODEL_ID,
            "content": [
                {
                    "type": "text",
                    "text": "这款产品在使用场景中展示，背景有轻柔的环境音",
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                },
            ],
            "ratio": "adaptive",
            "duration": 5,
            "generate_audio": True,
            "watermark": False,
        }
        data = create_task(payload)
        set_last_raw(data)
        task_id = data.get("id")
        if not task_id:
            print(f"  [FAIL] 创建任务未返回 task_id")
            save_response("11_image_video_audio", {"error": "no task_id", "response": data})
            return

        result = poll_and_download(task_id, "seedance_11_img2v_audio")
        result["input_modality"] = "text+image+audio_generation"
        save_response("11_image_video_audio", result)
    except Exception as e:
        print(f"  [FAIL] {e}")
        save_response("11_image_video_audio", {"error": str(e)})


if __name__ == "__main__":
    print("=" * 60)
    print("Doubao-Seedance-1.5-pro 扩展能力测试")
    print(f"模型 ID: {MODEL_ID}")
    print(f"API Base: {BASE_URL}")
    print("=" * 60)

    test_07_first_last_frame()
    test_08_return_last_frame()
    test_09_seed()
    test_10_more_ratios()
    test_11_image_to_video_with_audio()

    print("\n" + "=" * 60)
    print("扩展测试完成，结果保存在:", OUTPUT_DIR)
    print("=" * 60)
