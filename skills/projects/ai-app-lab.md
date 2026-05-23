---
name: ai-app-lab
id: 3d4e5f6a-7b8c-4d5e-6f7a-8b9c0d1e2f3a
description: 火山方舟官方 AI App Lab 可复用技术/思路速查。面向电商 AIGC 视频生成比赛，提炼其 Arkitect SDK 设计哲学、Demohouse 原型应用中的多模态交互与 RTC 实时对话方案。
---

# AI App Lab 项目可复用速查

## 一句话定位
火山方舟官方高代码应用实验室。提供 Python SDK「Arkitect」+ 海量开源 Demohouse 原型。其中 **ad_video_gen（电商营销视频 Multi-Agent 系统）** 是与比赛主题最贴合的官方 Demo，详见独立 Skill [ad-video-gen](ad-video-gen.md)。

## 可复用技术栈（按比赛 P0/P1 映射）

| 技术点 | Arkitect / Demohouse 实现 | 比赛借鉴点 | 优先级 |
|---|---|---|---|
| 高代码 SDK | Arkitect (Python SDK，工具集 + 流程集) | 若后端用 Python，可直接引入 Arkitect 封装火山模型调用，减少样板代码 | P0 |
| 多模态理解 | video_analyser 实时视觉 + 语音理解 | 比赛“素材库”模块：对上传的视频素材做自动摘要、标签提取 | P1 |
| 实时对话 | rtc_conversational_ai 超低延迟 AI 对话 | 比赛若需“AI 实时调整剧本/分镜”的交互形态，可借鉴 RTC 接入方案 | P2 |
| 双语生成 | chat2cartoon 双语视频生成 | 比赛若做跨境 TikTok Shop，多语种字幕/配音是刚需 | P1 |
| 长记忆 | longterm_memory 对话记忆抽取与召回 | 比赛可扩展为“商家偏好记忆”（常用风格、目标人群），后续自动推荐 | P2 |
| Deep Research | deep_research 多角度分析 + 联网搜索 | 比赛“方法论提炼”模块：对爆款视频做结构化拆解，自动聚类策略 | P1 |
| **电商视频 Multi-Agent** | **ad_video_gen（VeADK + A2A）** | **比赛核心：导演/评估/营销/发布多 Agent 协作，AIDA 分镜，抽卡择优** | **P0** |

## 核心架构可借鉴

```
Arkitect SDK 层
  ├── 模型调用封装（LLM / 多模态 / 嵌入）
  ├── 工具调用框架（Function Calling）
  ├── 流程编排（State Machine / DAG）
  └── 可观测性（日志 / Trace）

Demohouse 应用层
  ├── chat2cartoon（双语视频）
  ├── deep_research（深度推理）
  ├── live_voice_call（语音实时通话）
  ├── video_analyser（视频理解）
  ├── rtc_conversational_ai（实时对话）
  └── ...
```

**比赛适配建议：**
- 后端若用 Python，优先调研 Arkitect SDK 是否能直接集成，避免重复造轮子。
- `video_analyser` 的“实时视觉理解”可移植到素材库模块：上传商品视频 → 自动抽帧 → Seed-2.0-pro 理解内容 → 生成结构化标签。
- `deep_research` 的“多角度分析”逻辑可移植到剧本模块：输入爆款视频 URL → 联网抓取信息 → Seed-2.0-pro 拆解 Hook/卖点/分镜/风格。

## 关键代码模式

### 1. Arkitect 风格模型调用（伪代码）
```python
from arkitect.core.component.llm import BaseChatLLM
from arkitect.core.component.llm.model import ArkChatRequest, ArkChatResponse

async def generate_script(product_info: dict) -> dict:
    llm = BaseChatLLM()
    request = ArkChatRequest(
        model="ep-your-seed-ep",
        messages=[
            {"role": "system", "content": "你是电商带货视频剧本专家..."},
            {"role": "user", "content": f"商品信息：{product_info}"}
        ],
        response_format={"type": "json_object"}
    )
    response: ArkChatResponse = await llm.achat(request)
    return json.loads(response.choices[0].message.content)
```
*Arkitect 封装了重试、流式、工具调用等逻辑，比赛可直接使用或借鉴其接口设计。*

### 2. 视频理解素材标签提取
```python
# 参考 video_analyser 思路
async def analyze_video(video_path: str) -> dict:
    # 1. 抽帧（fps=1，控制 token）
    frames = extract_frames(video_path, fps=1)
    # 2. Seed-2.0-pro 多模态理解
    response = client.chat.completions.create(
        model=SEED_EP,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": "分析这段商品视频，提取：主体、卖点、场景、镜头运动、风格标签"},
                *[{ "type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{f}"} } for f in frames]
            ]
        }]
    )
    return json.loads(response.choices[0].message.content)
```
*素材库“多颗粒度结构化”的核心能力。*

## 关键路径速查

| 相对路径 | 类/函数/模块 | 用途 |
|---|---|---|
| `arkitect/core/component/llm/__init__.py` | `BaseChatLanguageModel`, `ArkChatRequest`, `ArkChatResponse`, `ArkChatCompletionChunk` | LLM 核心抽象与请求/响应类型 |
| `arkitect/core/component/llm/llm.py` | `BaseChatLanguageModel` | 基础聊天模型实现（流式/非流式） |
| `arkitect/core/component/agent/` | `base_agent.py`, `default_agent.py`, `parallel_agent.py` | Agent 编排：默认 Agent、并行 Agent |
| `arkitect/core/component/asr/asr_client.py` | `ASRClient` | 语音识别客户端 |
| `arkitect/core/component/tts/` | TTS 模块 | 语音合成封装 |
| `arkitect/core/component/tool/` | 工具模块 | Function Calling 工具定义与执行 |
| `arkitect/core/component/prompts/` | Prompt 管理 | 系统提示词模板管理 |
| `arkitect/core/client/` | `base.py`, `http.py`, `sse.py` | HTTP 客户端、SSE 流式客户端 |
| `demohouse/chat2cartoon/` | 双语视频生成 | 参考多语种字幕/配音实现 |
| `demohouse/deep_research/` | 深度推理 | 参考联网搜索+多角度分析实现 |
| `demohouse/video_analyser/` | 视频实时理解 | 参考视频抽帧+多模态理解实现 |
| `demohouse/rtc_conversational_ai/` | 实时对话 AI | 参考 RTC 信令+超低延迟对话实现 |
| `demohouse/longterm_memory/` | 长记忆方案 | 参考对话记忆抽取与召回实现 |
| `demohouse/live_voice_call/` | 语音实时通话 | 参考语音交互实现 |

## 踩坑与避坑

| 坑点 | 原因 | 比赛规避 |
|---|---|---|
| Arkitect SDK 文档较少 | 官方较新 | 直接阅读源码 + Demohouse 示例代码学习 |
| Demohouse 多为原型级 | 未经过生产打磨 | 借鉴其“交互形态”和“模型调用方式”，工程化需自己补齐 |
| RTC 接入门槛高 | 需要信令服务器 + 音视频处理 | 比赛若不做实时通话，可跳过 RTC；若做，优先复用 Demohouse 的 rtc_conversational_ai |

## 一句话总结
AI App Lab 最值钱的是**“Arkitect SDK 的工程化封装 + Demohouse 的垂直场景交互形态”**。它是火山生态的官方最佳实践，比赛后端选型 Python 时应优先调研 Arkitect 复用可能性。
