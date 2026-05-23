"""
Doubao-Seed-2.0-pro API 测试脚本

测试目标：
1. 纯文本输入输出
2. 图片输入（视觉理解）
3. 系统提示词 + JSON 结构化输出
4. 流式输出
5. 多轮对话
6. 视频/音频/PDF 输入兼容性（记录是否支持）

环境变量来自项目根目录 .env 文件。
"""

import os
import sys
import json
import base64
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from openai import OpenAI
import requests

# 加载项目根目录的 .env
PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

# 配置
BASE_URL = os.getenv("VOLC_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
API_KEY = os.getenv("VOLC_API_KEY")
MODEL_EP = os.getenv("DOUBAO_SEED_EP")

# 测试数据目录
EVAL_DIR = PROJECT_ROOT / "datasets" / "eval"

# 输出目录
OUTPUT_DIR = PROJECT_ROOT / "outputs" / "api_results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

if not API_KEY or not MODEL_EP:
    print("[ERROR] VOLC_API_KEY 或 DOUBAO_SEED_EP 未在 .env 中配置")
    sys.exit(1)

client = OpenAI(
    base_url=BASE_URL,
    api_key=API_KEY,
)


def encode_image(image_path: Path) -> str:
    """将图片转为 base64 字符串"""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


# 用于暂存最近一次 API 调用的原始响应结构
_last_raw_response = None


def set_last_raw(response_obj):
    """捕获模型返回的原始结构（反序列化后的完整字典）"""
    global _last_raw_response
    try:
        _last_raw_response = response_obj.model_dump()
    except Exception:
        _last_raw_response = {"_error": "无法序列化", "_str": str(response_obj)}


def save_response(test_name: str, response_data: dict):
    """保存响应结果到 JSON 文件（包含原始响应结构）"""
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    out_path = OUTPUT_DIR / f"seed_{test_name}_{timestamp}.json"
    payload = {
        "parsed": response_data,
        "raw_response": _last_raw_response,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"  结果已保存: {out_path}")


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


def test_01_pure_text():
    """测试 1：纯文本对话"""
    print("\n[TEST 01] 纯文本对话")
    try:
        response = client.chat.completions.create(
            model=MODEL_EP,
            messages=[
                {"role": "user", "content": "请用一句话介绍抖音电商的短视频带货模式"}
            ],
        )
        content = response.choices[0].message.content
        set_last_raw(response)
        print(f"  输入模态: text")
        print(f"  输出模态: text")
        print(f"  输出内容: {content[:200]}...")
        save_response("01_pure_text", {
            "input_modality": "text",
            "output_modality": "text",
            "content": content,
            "usage": response.usage.model_dump() if response.usage else None,
        })
    except Exception as e:
        print(f"  [FAIL] {e}")


def test_02_image_understanding():
    """测试 2：图片输入（视觉理解）"""
    print("\n[TEST 02] 图片输入理解")
    image_path = EVAL_DIR / "微信图片_20260221134938_6_1.jpg"
    if not image_path.exists():
        print(f"  [SKIP] 图片不存在: {image_path}")
        return

    try:
        b64 = encode_image(image_path)
        response = client.chat.completions.create(
            model=MODEL_EP,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "请描述这张图片中的商品，包括类别、外观特征、使用场景。用 JSON 格式输出：{\"category\":\"\",\"features\":[],\"scene\":\"\"}"},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                    ],
                }
            ],
        )
        content = response.choices[0].message.content
        set_last_raw(response)
        print(f"  输入模态: text + image(jpeg)")
        print(f"  输出模态: text")
        print(f"  输出内容: {content[:300]}...")
        save_response("02_image_understanding", {
            "input_modality": "text+image(jpeg)",
            "output_modality": "text",
            "content": content,
            "usage": response.usage.model_dump() if response.usage else None,
        })
    except Exception as e:
        print(f"  [FAIL] {e}")


def test_03_json_mode():
    """测试 3：JSON 结构化输出（response_format）"""
    print("\n[TEST 03] JSON 结构化输出")
    try:
        response = client.chat.completions.create(
            model=MODEL_EP,
            messages=[
                {"role": "system", "content": "你是一个电商短视频分析助手。请严格按 JSON 格式输出。"},
                {"role": "user", "content": "分析以下商品信息并输出结构化数据：商品标题='温和氨基酸洗面奶，控油祛痘'，卖点=['泡沫绵密','不紧绷','敏感肌可用']。输出字段：title, category, selling_points, target_audience, visual_style"}
            ],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        set_last_raw(response)
        # 尝试解析验证
        parsed = json.loads(content)
        print(f"  输入模态: text")
        print(f"  输出模态: json_object")
        print(f"  解析结果: {json.dumps(parsed, ensure_ascii=False, indent=2)[:300]}...")
        save_response("03_json_mode", {
            "input_modality": "text",
            "output_modality": "json_object",
            "content": content,
            "parsed": parsed,
            "usage": response.usage.model_dump() if response.usage else None,
        })
    except Exception as e:
        print(f"  [FAIL] {e}")


def test_04_streaming():
    """测试 4：流式输出"""
    print("\n[TEST 04] 流式输出")
    try:
        stream = client.chat.completions.create(
            model=MODEL_EP,
            messages=[
                {"role": "user", "content": "请写一段 15 秒电商带货视频的口播文案，商品是防晒霜"}
            ],
            stream=True,
        )
        chunks = []
        print("  流式输出: ", end="", flush=True)
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                chunks.append(delta)
                print(delta, end="", flush=True)
        full_text = "".join(chunks)
        set_last_raw({"stream": True, "chunks_count": len(chunks), "full_text": full_text})
        print(f"\n  输入模态: text")
        print(f"  输出模态: text(stream)")
        save_response("04_streaming", {
            "input_modality": "text",
            "output_modality": "text(stream)",
            "content": full_text,
        })
    except Exception as e:
        print(f"  [FAIL] {e}")


def test_05_multiturn():
    """测试 5：多轮对话（上下文记忆）"""
    print("\n[TEST 05] 多轮对话")
    try:
        messages = [
            {"role": "user", "content": "我想为一个美妆产品生成带货视频剧本"},
        ]
        # 第一轮
        resp1 = client.chat.completions.create(model=MODEL_EP, messages=messages)
        reply1 = resp1.choices[0].message.content
        messages.append({"role": "assistant", "content": reply1})
        print(f"  Round 1 助手: {reply1[:150]}...")

        # 第二轮
        messages.append({"role": "user", "content": "这个剧本很好，但我想把目标人群改成大学生，风格更活泼一些"})
        resp2 = client.chat.completions.create(model=MODEL_EP, messages=messages)
        reply2 = resp2.choices[0].message.content
        set_last_raw(resp2)
        print(f"  Round 2 助手: {reply2[:150]}...")

        print(f"  输入模态: text(multi-turn)")
        print(f"  输出模态: text")
        save_response("05_multiturn", {
            "input_modality": "text(multi-turn)",
            "output_modality": "text",
            "rounds": [
                {"user": messages[0]["content"], "assistant": reply1},
                {"user": messages[2]["content"], "assistant": reply2},
            ],
            "usage_round2": resp2.usage.model_dump() if resp2.usage else None,
        })
    except Exception as e:
        print(f"  [FAIL] {e}")


def test_06_video_input():
    """测试 6：视频输入兼容性（记录是否支持）"""
    print("\n[TEST 06] 视频输入兼容性")
    video_path = EVAL_DIR / "02_u16_r04_c_01_exo_480.mp4"
    if not video_path.exists():
        print(f"  [SKIP] 视频不存在: {video_path}")
        return

    try:
        # 尝试将视频转为 base64（作为 image_url 类型或文件上传）
        # 火山方舟部分模型支持视频输入，格式可能为 video_url 或文件
        with open(video_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

        response = client.chat.completions.create(
            model=MODEL_EP,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "请描述这个视频的内容"},
                        {"type": "video_url", "video_url": {"url": f"data:video/mp4;base64,{b64}", "fps": 1}},
                    ],
                }
            ],
        )
        content = response.choices[0].message.content
        set_last_raw(response)
        print(f"  输入模态: text + video(mp4)")
        print(f"  输出模态: text")
        print(f"  [SUCCESS] 模型支持视频输入！")
        save_response("06_video_input", {
            "input_modality": "text+video(mp4)",
            "output_modality": "text",
            "content": content,
            "supported": True,
        })
    except Exception as e:
        error_msg = str(e)
        set_last_raw({"error": error_msg, "source": "exception"})
        print(f"  输入模态: text + video(mp4)")
        print(f"  [RESULT] 视频输入不支持或格式错误")
        print(f"  错误信息: {error_msg[:200]}")
        save_response("06_video_input", {
            "input_modality": "text+video(mp4)",
            "output_modality": None,
            "supported": False,
            "error": error_msg,
        })


def test_07_audio_input():
    """测试 7：音频输入兼容性"""
    print("\n[TEST 07] 音频输入兼容性")
    audio_path = EVAL_DIR / "audio-zh-05_为什么天空是蓝色的.mp3"
    if not audio_path.exists():
        print(f"  [SKIP] 音频不存在: {audio_path}")
        return

    try:
        with open(audio_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

        response = client.chat.completions.create(
            model=MODEL_EP,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "请转写这段音频的内容"},
                        {"type": "input_audio", "input_audio": {"data": b64, "format": "audio/mpeg"}},
                    ],
                }
            ],
        )
        content = response.choices[0].message.content
        set_last_raw(response)
        print(f"  输入模态: text + audio(mp3)")
        print(f"  输出模态: text")
        print(f"  [SUCCESS] 模型支持音频输入！")
        save_response("07_audio_input", {
            "input_modality": "text+audio(mp3)",
            "output_modality": "text",
            "content": content,
            "supported": True,
        })
    except Exception as e:
        error_msg = str(e)
        set_last_raw({"error": error_msg, "source": "exception"})
        print(f"  输入模态: text + audio(mp3)")
        print(f"  [RESULT] 音频输入不支持或格式错误")
        print(f"  错误信息: {error_msg[:200]}")
        save_response("07_audio_input", {
            "input_modality": "text+audio(mp3)",
            "output_modality": None,
            "supported": False,
            "error": error_msg,
        })


def test_08_pdf_input():
    """测试 8：PDF 文档输入兼容性"""
    print("\n[TEST 08] PDF 文档输入兼容性")
    pdf_path = EVAL_DIR / "Video Diffusion Models.pdf"
    if not pdf_path.exists():
        print(f"  [SKIP] PDF 不存在: {pdf_path}")
        return

    try:
        with open(pdf_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

        response = client.chat.completions.create(
            model=MODEL_EP,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "请总结这篇论文的核心观点"},
                        {"type": "image_url", "image_url": {"url": f"data:application/pdf;base64,{b64}"}},
                    ],
                }
            ],
        )
        content = response.choices[0].message.content
        set_last_raw(response)
        print(f"  输入模态: text + pdf")
        print(f"  输出模态: text")
        print(f"  [SUCCESS] 模型支持 PDF 输入！")
        save_response("08_pdf_input", {
            "input_modality": "text+pdf",
            "output_modality": "text",
            "content": content,
            "supported": True,
        })
    except Exception as e:
        error_msg = str(e)
        set_last_raw({"error": error_msg, "source": "exception"})
        print(f"  输入模态: text + pdf")
        print(f"  [RESULT] PDF 输入不支持或格式错误")
        print(f"  错误信息: {error_msg[:200]}")
        save_response("08_pdf_input", {
            "input_modality": "text+pdf",
            "output_modality": None,
            "supported": False,
            "error": error_msg,
        })


def test_09_system_prompt():
    """测试 9：系统提示词效果"""
    print("\n[TEST 09] 系统提示词约束")
    try:
        response = client.chat.completions.create(
            model=MODEL_EP,
            messages=[
                {"role": "system", "content": "你是一个电商短视频脚本生成专家。你的回答必须只包含分镜脚本，不要任何解释性文字。格式：每行一个分镜，包含'镜头|画面描述|台词|时长'。"},
                {"role": "user", "content": "为一款防晒霜生成 15 秒带货视频分镜"}
            ],
        )
        content = response.choices[0].message.content
        set_last_raw(response)
        print(f"  输入模态: text (含 system prompt)")
        print(f"  输出模态: text")
        print(f"  输出内容:\n{content[:400]}...")
        save_response("09_system_prompt", {
            "input_modality": "text",
            "output_modality": "text",
            "content": content,
            "usage": response.usage.model_dump() if response.usage else None,
        })
    except Exception as e:
        print(f"  [FAIL] {e}")


def test_10_long_context():
    """测试 10：长文本输入（测试 TPM 限制下的表现）"""
    print("\n[TEST 10] 长文本输入")
    long_text = "请分析以下电商商品信息。" + "这是一款非常好用的产品。" * 500  # 约 1500 tokens
    try:
        response = client.chat.completions.create(
            model=MODEL_EP,
            messages=[
                {"role": "user", "content": long_text + "\n\n请总结以上商品的3个核心卖点。"}
            ],
        )
        content = response.choices[0].message.content
        set_last_raw(response)
        print(f"  输入长度: ~{len(long_text)} 字符")
        print(f"  输出模态: text")
        print(f"  输出内容: {content[:200]}...")
        save_response("10_long_context", {
            "input_modality": "text(long)",
            "output_modality": "text",
            "input_length_chars": len(long_text),
            "content": content,
            "usage": response.usage.model_dump() if response.usage else None,
        })
    except Exception as e:
        print(f"  [FAIL] {e}")


def test_11_image_generation():
    """测试 11：图片生成能力（模型是否支持输出图片）"""
    print("\n[TEST 11] 图片生成能力")
    prompt = (
        "请生成一张电商产品展示图：一瓶防晒霜放在白色大理石台面上，"
        "背景是淡蓝色渐变，光线柔和，产品标签清晰可见，高清摄影风格"
    )
    try:
        response = client.chat.completions.create(
            model=MODEL_EP,
            messages=[
                {"role": "user", "content": prompt}
            ],
        )
        content = response.choices[0].message.content
        set_last_raw(response)
        print(f"  输入模态: text")
        print(f"  输出原始内容: {content[:500]}...")

        # 尝试提取图片 URL
        image_url = None
        if "http" in content:
            import re
            urls = re.findall(r'https?://[^\s\)\"\]]+\.(?:jpg|jpeg|png|gif|webp)', content, re.IGNORECASE)
            if not urls:
                urls = re.findall(r'https?://[^\s\)\"\]]+', content)
            if urls:
                image_url = urls[0]
                print(f"  提取到 URL: {image_url}")

        # 检查是否是 markdown 图片格式
        md_images = []
        if "![" in content:
            import re
            md_images = re.findall(r'!\[.*?\]\((.*?)\)', content)
            if md_images and not image_url:
                image_url = md_images[0]
                print(f"  提取到 Markdown 图片: {image_url}")

        result = {
            "input_modality": "text",
            "output_modality": "unknown",
            "output_raw": content,
            "image_url": image_url,
            "md_images": md_images,
            "usage": response.usage.model_dump() if response.usage else None,
        }

        if image_url:
            ext = Path(image_url.split("?")[0]).suffix or ".png"
            save_path = OUTPUT_DIR / f"seed_11_image_gen_{time.strftime('%H%M%S')}{ext}"
            success = download_media(image_url, save_path)
            result["download_success"] = success
            result["local_path"] = str(save_path) if success else None
            result["output_modality"] = "image" if success else "text"
            if success:
                print(f"  [SUCCESS] 模型支持图片生成/返回图片 URL！")
            else:
                print(f"  [RESULT] 模型返回了 URL 但下载失败，可能支持图片输出")
        else:
            print(f"  [RESULT] 模型未返回图片 URL，仅返回文本描述")
            result["output_modality"] = "text"
            result["supports_image_generation"] = False

        save_response("11_image_generation", result)
    except Exception as e:
        print(f"  [FAIL] {e}")
        save_response("11_image_generation", {"error": str(e)})


def test_12_file_upload_video():
    """测试 12：通过文件上传接口传视频（尝试绕过 base64 image_url 限制）"""
    print("\n[TEST 12] 文件上传方式传视频")
    video_path = EVAL_DIR / "02_u16_r04_c_01_exo_480.mp4"
    if not video_path.exists():
        print(f"  [SKIP] 视频不存在: {video_path}")
        return

    file_obj = None
    try:
        # Step 1: 上传视频文件到方舟文件服务
        print(f"  正在上传视频文件: {video_path.name} ({video_path.stat().st_size} bytes)")
        with open(video_path, "rb") as f:
            file_obj = client.files.create(file=f, purpose="user_data")
        print(f"  文件上传成功，file_id: {file_obj.id}")
        set_last_raw(file_obj)

        # Step 2: 在对话中引用上传的视频文件
        response = client.chat.completions.create(
            model=MODEL_EP,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "请描述这个视频的画面内容和场景"},
                        {"type": "file", "file": {"file_id": file_obj.id}},
                    ],
                }
            ],
        )
        content = response.choices[0].message.content
        set_last_raw(response)
        print(f"  输入模态: text + video(file_upload)")
        print(f"  输出模态: text")
        print(f"  [SUCCESS] 文件上传方式支持视频输入！")
        print(f"  输出内容: {content[:300]}...")
        save_response("12_file_upload_video", {
            "input_modality": "text+video(file_upload)",
            "output_modality": "text",
            "file_id": file_obj.id,
            "content": content,
            "supported": True,
            "usage": response.usage.model_dump() if response.usage else None,
        })
    except Exception as e:
        error_msg = str(e)
        set_last_raw({"error": error_msg, "source": "exception"})
        print(f"  输入模态: text + video(file_upload)")
        print(f"  [RESULT] 文件上传方式不支持视频或接口未开放")
        print(f"  错误信息: {error_msg[:300]}")
        save_response("12_file_upload_video", {
            "input_modality": "text+video(file_upload)",
            "output_modality": None,
            "file_id": file_obj.id if file_obj else None,
            "supported": False,
            "error": error_msg,
        })


if __name__ == "__main__":
    print("=" * 60)
    print("Doubao-Seed-2.0-pro API 能力测试")
    print(f"模型端点: {MODEL_EP}")
    print(f"API Base: {BASE_URL}")
    print(f"测试数据: {EVAL_DIR}")
    print("=" * 60)

    test_01_pure_text()
    test_02_image_understanding()
    test_03_json_mode()
    test_04_streaming()
    test_05_multiturn()
    test_06_video_input()
    test_07_audio_input()
    test_08_pdf_input()
    test_09_system_prompt()
    test_10_long_context()
    test_11_image_generation()
    test_12_file_upload_video()

    print("\n" + "=" * 60)
    print("测试完成，结果保存在:", OUTPUT_DIR)
    print("=" * 60)
