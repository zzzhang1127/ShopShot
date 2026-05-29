---
name: wan-integration
description: ShopShot 已整合 Wan-skills（DashScope 生图）与 Wan2.2（电影级 prompt 扩写）的 Agent 能力映射。
---

# Wan × ShopShot Agent 整合

## 能力映射

| 参考项目 | ShopShot 组件 | 作用 |
|---------|---------------|------|
| Wan2.2 `prompt_extend` | `PromptAgent` + `wan_cinematic.py` | 分镜画面/运镜电影级扩写（经 Seed LLM） |
| Wan-skills `wan2.7-image` | `WanImageClient` + `VisualAgent` | 无参考图时自动生成分镜参考图 |
| Wan2.2 I2V 思路 | `WanVideoClient` | Seedance 失败时可选 DashScope 图生视频回退 |
| Wan2.2 任务类型 | `pipeline_preset` i2v / action_transfer | 与 ComfyUI 管线配合 |

## 环境变量

```env
DASHSCOPE_API_KEY=...
WAN_PROMPT_ENHANCE_ENABLED=true   # 默认开，用火山 Seed 做扩写
WAN_IMAGE_ENABLED=true            # 需百炼 Key
WAN_AUTO_REFERENCE_IMAGES=true    # 生成视频前补参考图
WAN_VIDEO_ENABLED=false           # 可选 Seedance 回退
```

## Director 流程（增强后）

```
剧本生成 → [wan_visual_prepare] → 逐镜 Seedance（prompt 已增强）→ 后处理
```

## API

- `GET /agents/capabilities`
- `POST /agents/enhance-prompt`
