"""
Doubao-Seedance-1.5-pro API 测试脚本（基于原生异步任务接口）

Seedance 不走 chat.completions，而是使用独立的视频生成任务接口：
  - 创建任务: POST /api/v3/contents/generations/tasks
  - 查询任务: GET  /api/v3/contents/generations/tasks/{task_id}

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
MODEL_ID = os.getenv("DOUBAO_SEEDANCE_EP")  # Seedance 必须用 EP ID 调用，不能用模型 ID

# 测试数据目录
EVAL_DIR = PROJECT_ROOT / "datasets" / "eval"

# 输出目录
OUTPUT_DIR = PROJECT_ROOT / "outputs" / "api_results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

if not API_KEY:
    print("[ERROR] VOLC_API_KEY 未在 .env 中配置")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

# 用于暂存最近一次 API 调用的原始响应结构
_last_raw_response = None


def set_last_raw(response_data: dict):
    """捕获接口返回的原始结构"""
    global _last_raw_response
    _last_raw_response = response_data


def save_response(test_name: str, response_data: dict):
    """保存响应结果到 JSON 文件（包含原始响应结构）"""
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
    """将图片转为 base64 字符串"""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def download_media(url: str, save_path: Path) -> bool:
    """下载媒体文件（图片/视频）到本地"""
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
    """创建视频生成任务，返回原始响应字典"""
    url = f"{BASE_URL}/contents/generations/tasks"
    resp = requests.post(url, headers=HEADERS, json=payload, timeout=30)
    resp.raise_for_status()
    return resp.json()


def get_task(task_id: str) -> dict:
    """查询任务状态，返回原始响应字典"""
    url = f"{BASE_URL}/contents/generations/tasks/{task_id}"
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


def poll_and_download(task_id: str, save_prefix: str, max_wait: int = 300) -> dict:
    """轮询任务直到完成或超时，下载视频"""
    print(f"  任务已创建: {task_id}，开始轮询...")
    start = time.time()
    while time.time() - start < max_wait:
        data = get_task(task_id)
        status = data.get("status", "unknown")
        print(f"    [{time.strftime('%H:%M:%S')}] status={status}")

        if status == "succeeded":
            video_url = data.get("content", {}).get("video_url")
            print(f"    [SUCCESS] 视频生成完成")
            print(f"    视频 URL: {video_url}")
            result = {
                "status": status,
                "video_url": video_url,
                "usage": data.get("usage"),
            }
            if video_url:
                ext = ".mp4"
                save_path = OUTPUT_DIR / f"{save_prefix}_{time.strftime('%H%M%S')}{ext}"
                success = download_media(video_url, save_path)
                result["download_success"] = success
                result["local_path"] = str(save_path) if success else None
            set_last_raw(data)
            return result

        if status == "failed":
            print(f"    [FAIL] 任务失败: {data.get('error')}")
            set_last_raw(data)
            return {"status": status, "error": data.get("error")}

        time.sleep(5)

    print(f"  [TIMEOUT] 超过 {max_wait}s 未获取到结果")
    return {"status": "timeout", "task_id": task_id}


def test_01_text_to_video():
    """测试 1：文生视频"""
    print("\n[TEST 01] 文生视频")
    payload = {
        "model": MODEL_ID,
        "content": [
            {
                "type": "text",
                "text": "一个精美的防晒霜产品展示视频，产品在阳光下闪闪发光，背景是海滩和蓝天，镜头缓慢推进，展现产品细节，光线明亮柔和，画面高清，适合电商带货",
            }
        ],
        "ratio": "adaptive",
        "duration": 5,
        "generate_audio": False,
        "watermark": False,
    }
    try:
        data = create_task(payload)
        set_last_raw(data)
        task_id = data.get("id")
        if not task_id:
            print(f"  [FAIL] 创建任务未返回 task_id: {json.dumps(data, ensure_ascii=False)[:500]}")
            save_response("01_text_to_video", {"error": "no task_id", "response": data})
            return

        result = poll_and_download(task_id, "seedance_01_text2video")
        result["input_modality"] = "text"
        save_response("01_text_to_video", result)
    except Exception as e:
        print(f"  [FAIL] {e}")
        save_response("01_text_to_video", {"error": str(e)})


def test_02_image_to_video():
    """测试 2：图生视频（首帧）"""
    print("\n[TEST 02] 图生视频")
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
                    "text": "让这张图片中的商品轻微旋转，光线柔和变化，营造高端电商展示效果",
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
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
            save_response("02_image_to_video", {"error": "no task_id", "response": data})
            return

        result = poll_and_download(task_id, "seedance_02_image2video")
        result["input_modality"] = "text+image(jpeg)"
        save_response("02_image_to_video", result)
    except Exception as e:
        print(f"  [FAIL] {e}")
        save_response("02_image_to_video", {"error": str(e)})


def test_03_parameters():
    """测试 3：参数影响（尺寸、时长、比例等）"""
    print("\n[TEST 03] 参数测试")
    prompt = "一款口红产品在白色背景上展示，镜头缓慢推进"

    param_sets = [
        {"desc": "默认参数", "extra": {}},
        {"desc": "竖版 9:16", "extra": {"ratio": "9:16", "resolution": "720p"}},
        {"desc": "横版 16:9", "extra": {"ratio": "16:9", "resolution": "720p"}},
        {"desc": "指定时长 5s", "extra": {"duration": 5}},
        {"desc": "生成音频", "extra": {"generate_audio": True}},
    ]

    for idx, param in enumerate(param_sets):
        print(f"\n  [PARAM {idx+1}] {param['desc']}")
        try:
            payload = {
                "model": MODEL_ID,
                "content": [{"type": "text", "text": prompt}],
                "ratio": "adaptive",
                "duration": 5,
                "generate_audio": False,
                "watermark": False,
            }
            payload.update(param["extra"])

            data = create_task(payload)
            set_last_raw(data)
            task_id = data.get("id")
            if not task_id:
                print(f"    [FAIL] 无 task_id")
                save_response(f"03_param_{idx+1}", {"params": param, "error": "no task_id"})
                continue

            result = poll_and_download(task_id, f"seedance_03_param_{idx+1}", max_wait=180)
            result["params"] = param
            save_response(f"03_param_{idx+1}_{param['desc'].replace(' ', '_')}", result)
        except Exception as e:
            print(f"    [FAIL] {e}")
            save_response(f"03_param_{idx+1}_{param['desc'].replace(' ', '_')}", {"params": param, "error": str(e)})


def test_04_draft_mode():
    """测试 4：样片模式（Draft）"""
    print("\n[TEST 04] 样片模式")
    try:
        # Step 1: 生成样片
        payload = {
            "model": MODEL_ID,
            "content": [
                {"type": "text", "text": "一款洗面奶挤出绵密泡沫的特写镜头，背景为简约浴室"}
            ],
            "ratio": "adaptive",
            "duration": 5,
            "draft": True,
            "watermark": False,
        }
        data = create_task(payload)
        set_last_raw(data)
        draft_task_id = data.get("id")
        if not draft_task_id:
            print(f"  [FAIL] 样片任务创建失败")
            save_response("04_draft_mode", {"stage": "create_draft", "error": "no task_id"})
            return

        draft_result = poll_and_download(draft_task_id, "seedance_04_draft", max_wait=180)
        if draft_result.get("status") != "succeeded":
            save_response("04_draft_mode", {"stage": "draft_failed", "result": draft_result})
            return

        # Step 2: 基于样片生成正式视频
        print(f"  样片完成，基于样片生成正式视频...")
        payload_final = {
            "model": MODEL_ID,
            "content": [
                {
                    "type": "draft_task",
                    "draft_task": {"id": draft_task_id},
                }
            ],
            "resolution": "720p",
            "watermark": False,
        }
        data_final = create_task(payload_final)
        set_last_raw(data_final)
        final_task_id = data_final.get("id")
        if not final_task_id:
            print(f"  [FAIL] 正式视频任务创建失败")
            save_response("04_draft_mode", {"stage": "create_final", "error": "no task_id"})
            return

        final_result = poll_and_download(final_task_id, "seedance_04_final", max_wait=300)
        final_result["draft_task_id"] = draft_task_id
        save_response("04_draft_mode", final_result)
    except Exception as e:
        print(f"  [FAIL] {e}")
        save_response("04_draft_mode", {"error": str(e)})


def test_05_batch_generate():
    """测试 5：批量生成（测试并发限制）"""
    print("\n[TEST 05] 批量生成（并发测试）")
    prompts = [
        "一款洗面奶的特写镜头，泡沫丰富",
        "一支口红在模特手中展示",
        "防晒霜在海滩上的产品展示",
    ]

    results = []
    task_ids = []
    start_time = time.time()

    # 批量提交任务
    for idx, prompt in enumerate(prompts):
        print(f"  [Submit {idx+1}/3] {prompt[:30]}...")
        try:
            payload = {
                "model": MODEL_ID,
                "content": [{"type": "text", "text": prompt}],
                "ratio": "adaptive",
                "duration": 5,
                "generate_audio": False,
                "watermark": False,
            }
            data = create_task(payload)
            tid = data.get("id")
            if tid:
                task_ids.append((idx, tid, prompt))
                print(f"    task_id: {tid}")
            else:
                results.append({"prompt": prompt, "status": "submit_fail", "response": data})
        except Exception as e:
            results.append({"prompt": prompt, "status": "submit_exception", "error": str(e)})
        time.sleep(1)

    # 轮询所有任务
    print(f"  开始轮询 {len(task_ids)} 个任务...")
    for idx, tid, prompt in task_ids:
        print(f"\n  [Poll {idx+1}] {prompt[:30]}...")
        res = poll_and_download(tid, f"seedance_05_batch_{idx+1}", max_wait=180)
        res["prompt"] = prompt
        results.append(res)

    elapsed = time.time() - start_time
    print(f"\n  总耗时: {elapsed:.2f}s")
    save_response("05_batch_generate", {
        "batch_size": len(prompts),
        "submitted": len(task_ids),
        "elapsed_seconds": elapsed,
        "results": results,
    })


def test_06_image_generation():
    """测试 6：图片生成能力（Seedance 是否支持输出静帧/图片）"""
    print("\n[TEST 06] 图片生成能力")
    try:
        payload = {
            "model": MODEL_ID,
            "content": [
                {"type": "text", "text": "请输出为一张 PNG 静帧图片，不要视频：一支口红在白色背景上的产品特写"}
            ],
            "ratio": "adaptive",
            "duration": 1,
            "watermark": False,
        }
        data = create_task(payload)
        set_last_raw(data)
        task_id = data.get("id")
        if not task_id:
            print(f"  [FAIL] 无 task_id")
            save_response("06_image_generation", {"error": "no task_id"})
            return

        result = poll_and_download(task_id, "seedance_06_image_gen", max_wait=180)
        result["input_modality"] = "text"
        result["tested_image_output"] = True
        save_response("06_image_generation", result)
    except Exception as e:
        print(f"  [FAIL] {e}")
        save_response("06_image_generation", {"error": str(e)})


if __name__ == "__main__":
    print("=" * 60)
    print("Doubao-Seedance-1.5-pro API 能力测试（原生任务接口）")
    print(f"模型 ID: {MODEL_ID}")
    print(f"API Base: {BASE_URL}")
    print(f"测试数据: {EVAL_DIR}")
    print("=" * 60)

    test_01_text_to_video()
    test_02_image_to_video()
    test_03_parameters()
    test_04_draft_mode()
    test_05_batch_generate()
    test_06_image_generation()

    print("\n" + "=" * 60)
    print("测试完成，结果保存在:", OUTPUT_DIR)
    print("=" * 60)
