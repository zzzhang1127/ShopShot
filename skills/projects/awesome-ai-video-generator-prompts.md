---
name: awesome-ai-video-generator-prompts
id: 4e5f6a7b-8c9d-5e6f-7a8b-9c0d1e2f3a4b
description: 视频生成 Prompt 库与工作流程可复用技术/思路速查。面向电商 AIGC 视频生成比赛，提炼其“结构化 Prompt 公式、运镜/灯光/风格词典、模型选择策略”中可直接复用的提示工程方案。
---

# 视频生成 Prompt 项目可复用速查

## 一句话定位
开源的 AI 视频生成 Prompt 库与工作流指南。整理了大量经过验证的视频生成提示词公式，覆盖文生视频、图生视频、相机运动、灯光风格等维度。

## 可复用技术栈（按比赛 P0/P1 映射）

| 技术点 | Prompt 库实现 | 比赛借鉴点 | 优先级 |
|---|---|---|---|
| 结构化 Prompt 公式 | `[时长][格式] of [主体] doing [动作]` | 剧本模块“画面描述”标准化输出，减少 Seedance 理解偏差 | P0 |
| 运镜词典 | Pan / Tilt / Dolly / Truck / Pedestal / Rack focus / 360° orbit 等 | 分镜脚本的“镜头运动”字段直接引用标准化术语 | P0 |
| 灯光词典 | Natural light / Golden hour / Softbox / Neon / Rim light 等 | 分镜脚本的“视觉风格”字段 | P1 |
| 风格词典 | Cinematic / Commercial / Documentary / Minimalist / Luxury 等 | 剧本“视觉风格”标签，用于后续聚类和模板匹配 | P1 |
| 模型选择矩阵 | 不同模型（Seedance / Runway / Pika 等）适合的 Prompt 类型 | 明确 Seedance 1.5-pro 的能力边界（不支持多模态参考/视频编辑/延长）| P0 |
| 图生视频工作流 | 首帧图 + motion prompt → 视频 | 比赛“素材+剧本→创作”链路：商品图作为首帧，prompt 控制运镜 | P0 |
| 文生视频工作流 | text only → 视频 | 纯创意镜头（无具体商品出镜时）使用 | P0 |

## 核心 Prompt 公式可借鉴

### 基础公式
```
[Duration] [Format] of [Subject] [Action], [Camera Movement], [Lighting], [Style], [Mood]
```

**比赛适配示例：**
```
5s close-up shot of a premium wireless earbuds rotating on marble surface,
slow dolly in, soft natural window light, clean minimalist commercial style,
calm and luxurious mood
```
*直接作为 Seedance `content.text` 输入，或存入分镜脚本的 `visual_description` 字段。*

### 电商带货专用模板
```
[时长] [景别] of [商品主体] [动作/状态], [镜头运动], [光线], [场景], [风格]
[卖点强调：如材质/工艺/使用场景]
```

| 商品类型 | Prompt 模板 |
|---|---|
| 美妆 | `3s extreme close-up of a lipstick bullet gliding on skin, macro rack focus, soft beauty light, pastel background, glossy commercial style` |
| 3C 数码 | `4s product hero shot of a smartphone floating in mid-air, slow 360° orbit, dramatic rim light, dark studio, tech premium style` |
| 食品 | `5s top-down shot of steaming coffee being poured into ceramic cup, gentle push in, warm golden hour light, rustic wooden table, cozy lifestyle style` |
| 服饰 | `4s medium shot of a model walking in linen dress, smooth tracking shot, natural outdoor light, beach boardwalk, breezy summer style` |

## 关键代码模式

### 1. Prompt 模板引擎
```python
from string import Template

SHOT_TEMPLATE = Template(
    "${duration}s ${shot_type} of ${subject} ${action}, "
    "${camera_movement}, ${lighting}, ${scene}, ${style}"
)

def render_shot_prompt(shot_config: dict) -> str:
    return SHOT_TEMPLATE.safe_substitute(shot_config)
```
*剧本模块生成结构化 prompt，再喂给 Seedance。*

### 2. 分镜 → Seedance 参数映射
```python
def shot_to_seedance_payload(shot: dict, first_frame_b64: str = None):
    content = [{"type": "text", "text": shot["visual_description"]}]
    if first_frame_b64:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{first_frame_b64}"},
            "role": "first_frame"
        })
    return {
        "model": SEEDANCE_EP,
        "content": content,
        "duration": shot["duration"],
        "ratio": shot.get("ratio", "9:16"),
        "resolution": shot.get("resolution", "720p"),
        "generate_audio": shot.get("has_voiceover", False),
        "watermark": False
    }
```
*分镜脚本字段与 Seedance API 字段一一映射。*

## 关键路径速查

| 相对路径 | 内容 | 用途 |
|---|---|---|
| `README.md` | Prompt 公式、运镜词典、灯光词典、风格词典 | 全部可复用知识在此文件中，无代码目录 |

> 注：本项目为纯 Prompt 库，无代码文件。关键资产为 README 中整理的结构化提示词模板与模型选择策略。

## 踩坑与避坑

| 坑点 | 原因 | 比赛规避 |
|---|---|---|
| Seedance 不支持负面 prompt | 模型未开放 | 用正面描述替代（如不用“不要模糊”，改用“sharp focus, crystal clear”） |
| 过于复杂的运动描述失效 | 模型理解有限 | 一次只描述 1~2 种运镜，避免“推轨+摇臂+旋转+zoom”堆叠 |
| 商品特征词被忽略 | 模型优先处理视觉动作 | 将商品名/特征放在 prompt 前部，强调权重 |
| 中英文混合 prompt 效果不稳定 | 训练语料偏向 | 统一用英文写 prompt（Seedance 对英文理解更好），或中英双语各试一遍 |

## 一句话总结
Prompt 库最值钱的是**“标准化 Prompt 公式 + 电商垂直场景模板”**。它是连接“剧本模块结构化输出”与“Seedance 高质量生成”的桥梁，直接决定生成视频的可控性和商用质感。
