---
name: seedance-chain
id: 6a7b8c9d-0e1f-7a8b-9c0d-1e2f3a4b5c6d
description: seedance-chain 项目可复用技术/思路速查。面向电商 AIGC 视频生成比赛，提炼其“Seedance 1.5-pro 链式续拍、首尾帧衔接、样片模式、批量并发控制、FFmpeg 合并”中可直接复用的导演工作流方案。
---

# seedance-chain 项目可复用速查

## 一句话定位
基于火山 Ark API 的 Seedance 1.5-pro 链式视频生成工具包。实现“半自动化导演工作流”：首帧生成视频 → 提取尾帧 → 尾帧作为下一镜首帧 → 循环续拍 → FFmpeg 拼接成长视频。

## 可复用技术栈（按比赛 P0/P1 映射）

| 技术点 | seedance-chain 实现 | 比赛借鉴点 | 优先级 |
|---|---|---|---|
| 链式续拍 | `return_last_frame: true` → 下载尾帧 → 作为下一镜 `first_frame` | 比赛 15s 视频可拆成 3~5 个 5s 分镜，逐镜衔接保证动作连贯性 | P1 |
| 首尾帧图生视频 | `role: first_frame` + `role: last_frame` | 分镜级干预：用户上传商品图作为首帧，指定退场画面作为尾帧 | P0 |
| 样片模式 | `draft: true`（仅 480p，成本 50%） | 剧本确认阶段先出 draft 预览，商家满意后再生成 720p/1080p 正式版 | P1 |
| 基于样片生正式版 | `type: draft_task` 引用 draft task ID | 从样片到正式版的无缝升级，保留同一语义 | P1 |
| 批量并发控制 | `--batch-size` 参数限制同时提交任务数 | Seedance 实测 3~5 并发可行，防止队列拥堵 | P0 |
| FFmpeg 拼接 | 多段视频 re-encode 合并，统一 codec/container | 多个 5s 分镜合并为 15s 成片 | P0 |
| 导演工作流 CLI | `--chain` / `--draft` / `--batch-size` 命令行参数 | 后端服务化：将 CLI 逻辑封装为 API 端点 | P1 |

## 核心流程可借鉴

```
剧本分镜（5s × 3镜 = 15s）
  → 第1镜：首帧=商品主图，prompt=开场运镜，duration=5，return_last_frame=true
  → 轮询完成 → 下载尾帧
  → 第2镜：首帧=第1镜尾帧，prompt=卖点展示运镜，duration=5，return_last_frame=true
  → 轮询完成 → 下载尾帧
  → 第3镜：首帧=第2镜尾帧，尾帧=品牌logo/黑屏，prompt=退场运镜，duration=5
  → 轮询完成
  → FFmpeg 拼接 3 段视频 → 15s 成片
```

**比赛适配建议：**
- 链式续拍解决 Seedance 单段最长 5s（实测常用）的限制，是生成 15s 电商视频的核心技术方案。
- 样片模式大幅降低剧本确认阶段的成本和时间，必须集成到“分镜级干预”流程中。
- 尾帧衔接的商品一致性：因为 Seedance 会居中裁剪图片，需保证所有帧图片比例一致。

## 关键代码模式

### 1. 单镜生成 + 尾帧提取
```python
async def generate_shot(prompt: str, first_frame_path: str = None, return_last: bool = True):
    content = [{"type": "text", "text": prompt}]
    if first_frame_path:
        b64 = encode_image(first_frame_path)
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
            "role": "first_frame"
        })

    resp = requests.post(f"{BASE}/contents/generations/tasks", headers=headers, json={
        "model": SEEDANCE_EP,
        "content": content,
        "duration": 5,
        "ratio": "9:16",
        "resolution": "720p",
        "return_last_frame": return_last,
        "watermark": False
    }).json()

    task_id = resp["id"]
    # 轮询...
    result = await poll_task(task_id)
    video_url = result["content"]["video_url"]
    last_frame_url = result["content"].get("last_frame_url")
    return video_url, last_frame_url
```

### 2. 链式导演控制器
```python
async def chain_director(shots: list[dict]):
    """shots: [{prompt, first_frame_path?}]"""
    videos = []
    last_frame = None

    for i, shot in enumerate(shots):
        is_last = (i == len(shots) - 1)
        video_url, last_frame_url = await generate_shot(
            prompt=shot["prompt"],
            first_frame_path=last_frame or shot.get("first_frame_path"),
            return_last_frame=not is_last
        )
        videos.append(download(video_url))
        if last_frame_url:
            last_frame = download(last_frame_url)

    # FFmpeg 合并
    concat_files(videos, "final.mp4")
    return "final.mp4"
```

### 3. FFmpeg 拼接（无 re-encode，快速）
```bash
# 先生成 concat list
echo "file 'shot1.mp4'" > list.txt
echo "file 'shot2.mp4'" >> list.txt
echo "file 'shot3.mp4'" >> list.txt

# 若各段编码参数一致，可直接 concat（无损快速）
ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp4

# 若编码参数不一致，需 re-encode
ffmpeg -f concat -safe 0 -i list.txt -c:v libx264 -crf 23 -preset fast -c:a aac output.mp4
```
*比赛建议：所有分镜用同一 ratio/resolution/duration，保证编码参数一致，可用 `-c copy` 极速合并。*

### 4. 样片 → 正式版升级
```python
async def upgrade_from_draft(draft_task_id: str):
    resp = requests.post(f"{BASE}/contents/generations/tasks", headers=headers, json={
        "model": SEEDANCE_EP,
        "content": [{"type": "draft_task", "draft_task": {"id": draft_task_id}}],
        "resolution": "720p",  # 样片只能 480p，正式版升级
        "watermark": False
    }).json()
    return resp["id"]
```

## 关键路径速查

| 相对路径 | 类/函数 | 用途 |
|---|---|---|
| `seedance_video.py` | `image_to_data_uri()`, `build_content()`, `submit_task()`, `query_task()`, `download_file()`, `wait_for_tasks()`, `concat_videos()`, `main()` | Seedance 导演工作流核心：任务提交、轮询、下载、FFmpeg 拼接 |
| `seedance_video.py` | `MODELS` dict | 模型 ID 映射表：`1.5pro` / `1.0pro` / `1.0fast` / `1.0lite-i` / `1.0lite-t` |
| `seedance_video.py` | `DEFAULTS` dict | 默认参数：duration=5, resolution=1080p, ratio=16:9 等 |
| `seedance_video.py` | `SHOTS` list | 镜头定义数组（id, name, prompt, first_frame, last_frame, draft_task_id 等） |
| `storyboard_script.py` | `STYLE_PREFIX`, `SHOTS` | 分镜脚本示例：武侠风格，含 dialogue/camera/transition/audio 字段 |
| `jimeng_video.py` | 即梦视频生成 | 即梦（Jimeng）API 调用，作为 Seedance fallback |
| `Seedance_API_经验手册.md` | 经验文档 | Seedance 调用踩坑记录与参数说明 |

## 踩坑与避坑

| 坑点 | 原因 | 比赛规避 |
|---|---|---|
| 尾帧图与下镜首帧风格漂移 | Seedance 生成有随机性 | 控制 `seed` 参数保持一致性；prompt 中强化风格关键词 |
| 居中裁剪导致商品被切 | Seedance 自动裁剪输入图以匹配 ratio | 上传前先将商品图按目标 ratio 人工裁剪/填充，避免自动裁剪 |
| draft 任务 ID 7 天过期 | 官方限制 | 商家确认样片需及时升级，或本地保存 draft 视频 URL |
| 链式总时长超过 15s 成本高 | 3镜×5s = 15s，每镜都消耗 token | 优先使用单镜 5s 直接出片；链式留给需要复杂叙事的场景 |
| concat 时音频不同步 | 各段音频采样率/时长差异 | 若用 `-c copy` 合并，确保所有分镜 `generate_audio` 设置一致 |

## 一句话总结
seedance-chain 最值钱的是**“链式续拍 + 样片模式 + FFmpeg 极速合并”**。它是把 Seedance 5s 限制扩展为 15s 电商成片的必备工程方案，也是“分镜级干预”的技术基础。
