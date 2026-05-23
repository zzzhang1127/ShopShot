---
name: volcengine-api-usage
description: >
  火山方舟 Seed-2.0-pro(LLM) + Seedance-1.5-pro(视频生成) 实测调用方式与能力边界。
  含所有踩坑经验：EP ID 调用、路径斜杠、video_url 格式、尾帧返回、样片模式等。
metadata:
  type: reference
  updated_at: 2026-05-21
---

# 能力速查（模型先读此表）

## Seed-2.0-pro（多模态 LLM）
| 模态 | 状态 | 关键格式 |
|------|------|----------|
| 纯文本 | ✅ | 默认 |
| 图片 | ✅ | `image_url` + base64 data URI |
| 视频 | ✅ | **`video_url`** + base64 + `fps: 1`（不能用 `image_url`） |
| 音频 | ❌ | 模型明确不支持，需外挂 ASR |
| PDF | ❌ | 不支持，需先提取文本/图片 |
| JSON 输出 | ✅ | `response_format={"type": "json_object"}` |
| 流式输出 | ✅ | `stream=True` |
| 系统提示词 | ✅ | `role="system"` |
| 直接生成图片 | ❌ | 只返回文本描述 |

## Seedance-1.5-pro（视频生成，异步任务接口）
| 能力 | 状态 | 关键参数 |
|------|------|----------|
| 文生视频 | ✅ | `content: [{type: "text"}]` |
| 图生视频-首帧 | ✅ | `image_url` |
| 图生视频-首尾帧 | ✅ | `role: "first_frame"` + `role: "last_frame"` |
| 生成有声视频 | ✅ | `generate_audio: true` |
| 样片模式 | ✅ | `draft: true`（仅 480p） |
| 基于样片生成正式视频 | ✅ | `type: "draft_task"` |
| 返回尾帧图 | ✅ | `return_last_frame: true` |
| 随机种子 | ✅ | `seed: 整数` |
| 离线推理 | ✅ | `service_tier: "flex"`（价格 50%，小时级） |
| 画面比例 | ✅ | 9:16 / 3:4 / 1:1 / 4:3 / 16:9 / 21:9 / adaptive |
| 分辨率 | ✅ | 480p / 720p / 1080p |
| 批量并发 | ✅ | 实测 3~5 条可行 |
| 输出静帧图片 | ❌ | 400 Bad Request |
| 多模态参考/编辑视频/延长视频 | ❌ | 仅 Seedance 2.0 支持 |

### 关键坑点
1. **必须用 EP ID 调用**，用模型 ID `doubao-seedance-1-5-pro-251215` 会报 404
2. **路径末尾不能加斜杠**：`/tasks/` 会报 404 `InvalidAction`
3. **视频 URL 带 TOS 签名，24 小时有效**，需及时下载
4. 图片输入时，平台会**居中裁剪**以匹配目标 `ratio`

---

# 正文：详细调用方式

## 一、账号与端点

`.env` 示例：
```bash
VOLC_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VOLC_API_KEY=your-api-key-here
DOUBAO_SEED_EP=your-seed-endpoint-id
DOUBAO_SEEDANCE_EP=your-seedance-endpoint-id
```

认证 Header：`Authorization: Bearer {API_KEY}`

## 二、Seed-2.0-pro

走 **OpenAI 兼容接口**：`POST /api/v3/chat/completions`

```python
from openai import OpenAI
client = OpenAI(base_url=BASE_URL, api_key=API_KEY)

response = client.chat.completions.create(
    model=os.getenv("DOUBAO_SEED_EP"),
    messages=[...]
)
```

### 视频输入格式
```json
{
  "type": "video_url",
  "video_url": {
    "url": "data:video/mp4;base64,{base64}",
    "fps": 1
  }
}
```
- `fps` 范围 `[0.2, 5]`，默认 1，控制抽帧频率节省 token

## 三、Seedance-1.5-pro

**不走 `chat.completions`**，走原生异步任务接口：
- 创建任务：`POST /api/v3/contents/generations/tasks`（末尾**不能**加 `/`）
- 查询任务：`GET /api/v3/contents/generations/tasks/{task_id}`

### 请求体示例

**文生视频**：
```json
{
  "model": "your-seedance-endpoint-id",
  "content": [{"type": "text", "text": "prompt"}],
  "ratio": "adaptive",
  "duration": 5,
  "generate_audio": false,
  "watermark": false
}
```

**图生视频（首帧）**：
```json
{
  "model": "your-seedance-endpoint-id",
  "content": [
    {"type": "text", "text": "prompt"},
    {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,{b64}"}}
  ],
  "duration": 5,
  "watermark": false
}
```

**首尾帧图生视频**：
```json
{
  "model": "your-seedance-endpoint-id",
  "content": [
    {"type": "text", "text": "360度环绕运镜"},
    {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,{b64}"}, "role": "first_frame"},
    {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,{b64}"}, "role": "last_frame"}
  ],
  "duration": 5,
  "watermark": false
}
```

**返回尾帧（用于连续视频串联）**：
```json
{
  "model": "your-seedance-endpoint-id",
  "content": [{"type": "text", "text": "prompt"}],
  "duration": 5,
  "return_last_frame": true,
  "watermark": false
}
```

**样片模式**：
```json
{
  "model": "your-seedance-endpoint-id",
  "content": [{"type": "text", "text": "..."}],
  "duration": 5,
  "draft": true,
  "watermark": false
}
```

**基于样片生成正式视频**：
```json
{
  "model": "your-seedance-endpoint-id",
  "content": [{"type": "draft_task", "draft_task": {"id": "cgt-xxx"}}],
  "resolution": "720p",
  "watermark": false
}
```

### 轮询查询响应
```json
{
  "id": "cgt-2026xxxx-xxxx",
  "status": "succeeded",
  "content": {
    "video_url": "https://... .mp4?...",
    "last_frame_url": "https://... .png?..."
  }
}
```
状态流转：`queued` → `running` → `succeeded` / `failed` / `expired`

### 分辨率像素对照表

| 比例 | 480p | 720p | 1080p |
|------|------|------|-------|
| 16:9 | 864×496 | 1280×720 | 1920×1080 |
| 4:3 | 752×560 | 1112×834 | 1664×1248 |
| 1:1 | 640×640 | 960×960 | 1440×1440 |
| 3:4 | 560×752 | 834×1112 | 1248×1664 |
| 9:16 | 496×864 | 720×1280 | 1080×1920 |
| 21:9 | 992×432 | 1470×630 | 2206×946 |

### 样片模式限制
- 仅 Seedance 1.5-pro 支持
- 仅支持 **480p**（其他分辨率报错）
- 不支持 `return_last_frame`
- 不支持 `service_tier: "flex"`
- Token 用量 = 正常用量 × 折算系数（有声视频 0.6）
- Draft 任务 ID 有效期 **7 天**

## 四、快速复用代码模板

```python
import requests, time

headers = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
base = "https://ark.cn-beijing.volces.com/api/v3"

# 创建任务
resp = requests.post(f"{base}/contents/generations/tasks", headers=headers, json={
    "model": "your-seedance-endpoint-id",
    "content": [{"type": "text", "text": "prompt"}],
    "duration": 5,
    "ratio": "adaptive",
    "watermark": False
}).json()
task_id = resp["id"]

# 轮询
while True:
    data = requests.get(f"{base}/contents/generations/tasks/{task_id}", headers=headers).json()
    if data["status"] == "succeeded":
        video_url = data["content"]["video_url"]
        break
    elif data["status"] == "failed":
        raise Exception(data["error"])
    time.sleep(5)
```

## 五、项目 workarounds

| 需求 | 模型原生支持 | 项目 workaround |
|------|------------|----------------|
| 视频理解 | Seed-2.0-pro 支持 `video_url` | 直接调用，控制 `fps` 节省 token |
| 音频理解 | ❌ | 先用 ASR 转文本，再送 LLM |
| PDF 理解 | ❌ | 先用 PyMuPDF/pdfplumber 提取文本/图片 |
| 图片生成 | ❌ | 调用文生图 API 或第三方 |
| 视频生成 | Seedance 支持 | 异步任务 + 轮询 |
| 连续视频拼接 | 需手动串联 | `return_last_frame` 递推 + FFmpeg 合并 |
