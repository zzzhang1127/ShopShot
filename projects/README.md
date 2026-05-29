# 参考项目（本地自行拉取）

`projects/` 下的参考仓库**体积较大**，未纳入 ShopShot 主仓库 Git 追踪（仅本文件入库）。请按需克隆到本目录；可复用技术速查见 [`skills/projects/`](../skills/projects/index.md)。

当前共 **12** 个参考项目（含 Wan 系列 2 个）。

## 一键拉取（PowerShell）

在 ShopShot 根目录执行：

```powershell
cd projects

# 1. AdGen — 前端架构标杆（Next.js + Remotion）
git clone https://github.com/Rakshath66/AdGen.git AdGen

# 2. ad_video_gen — 火山官方电商 Multi-Agent（仅 demohouse/ad_video_gen）
git clone --depth 1 --filter=blob:none --sparse https://github.com/volcengine/ai-app-lab.git ad_video_gen
cd ad_video_gen; git sparse-checkout set demohouse/ad_video_gen; cd ..

# 3. ai-app-lab — 火山官方 Demo 合集（仅 demohouse）
git clone --depth 1 --filter=blob:none --sparse https://github.com/volcengine/ai-app-lab.git ai-app-lab
cd ai-app-lab; git sparse-checkout set demohouse; cd ..

# 4. awesome-ai-video-generator-prompts — Cliprise Prompt 词典
git clone https://github.com/cliprise/awesome-ai-video-generator-prompts.git awesome-ai-video-generator-prompts

# 5. daihuo-jianshou — 带货能手（多模型 / 模板矩阵）
git clone https://github.com/xixihhhh/daihuo-jianshou.git daihuo-jianshou

# 6. Jellyfish — 异步任务与素材一致性
git clone https://github.com/Forget-C/Jellyfish.git Jellyfish

# 7. MoneyPrinterPlus — 批量混剪 / TTS / BGM
git clone https://github.com/ddean2009/MoneyPrinterPlus.git MoneyPrinterPlus

# 8. Pixelle-Video — ComfyUI 全自动短视频管线
git clone https://github.com/AIDC-AI/Pixelle-Video.git Pixelle-Video

# 9. seedance-chain — Seedance 链式续拍
git clone https://github.com/PCPrincipal67/seedance-chain.git seedance-chain

# 10. video-cut-agent — LangChain 剪辑 Agent
git clone https://github.com/DearWWWWWT/video-cut-agent.git video-cut-agent

# 11. Wan-skills — DashScope Wan2.7 生图/编辑 Agent Skill
git clone https://github.com/Wan-Video/Wan-skills.git Wan-skills

# 12. Wan2.2 — 开源 Wan 视频模型（T2V / I2V / TI2V / S2V / Animate）
git clone https://github.com/Wan-Video/Wan2.2.git Wan2.2
```

## 项目一览

| 目录 | 说明 | Skill | 仓库 |
|------|------|-------|------|
| `AdGen` | URL 抓取 + GPT 剧本 + Remotion 预览 | [adgen](../skills/projects/adgen.md) | https://github.com/Rakshath66/AdGen |
| `ad_video_gen` | VeADK 电商营销 Multi-Agent（导演 / 评估 / 发布） | [ad-video-gen](../skills/projects/ad-video-gen.md) | https://github.com/volcengine/ai-app-lab（`demohouse/ad_video_gen`） |
| `ai-app-lab` | 火山 Arkitect / 视频理解等官方 Demo | [ai-app-lab](../skills/projects/ai-app-lab.md) | https://github.com/volcengine/ai-app-lab（仅 `demohouse/`） |
| `awesome-ai-video-generator-prompts` | AI 视频 Prompt 公式与电商模板（Cliprise） | [awesome-ai-video-generator-prompts](../skills/projects/awesome-ai-video-generator-prompts.md) | https://github.com/cliprise/awesome-ai-video-generator-prompts |
| `daihuo-jianshou` | 带货视频批量生成与 A/B | [daihuo-jianshou](../skills/projects/daihuo-jianshou.md) | https://github.com/xixihhhh/daihuo-jianshou |
| `Jellyfish` | 任务中心 + 素材库工程化 | [jellyfish](../skills/projects/jellyfish.md) | https://github.com/Forget-C/Jellyfish |
| `MoneyPrinterPlus` | 混剪、配音、自动发布 | [moneyprinterplus](../skills/projects/moneyprinterplus.md) | https://github.com/ddean2009/MoneyPrinterPlus |
| `Pixelle-Video` | Pipeline + ComfyUI 工作流成片 | [pixelle-video](../skills/projects/pixelle-video.md) | https://github.com/AIDC-AI/Pixelle-Video |
| `seedance-chain` | Seedance 首尾帧链式生成 | [seedance-chain](../skills/projects/seedance-chain.md) | https://github.com/PCPrincipal67/seedance-chain |
| `video-cut-agent` | MoviePy / beat 检测剪辑 Agent | [video-cut-agent](../skills/projects/video-cut-agent.md) | https://github.com/DearWWWWWT/video-cut-agent |
| `Wan-skills` | Wan2.7 图像生成/编辑 + Agent Skill 脚本（百炼 API） | [wan-integration](../skills/projects/wan-integration.md) | https://github.com/Wan-Video/Wan-skills |
| `Wan2.2` | 开源视频 MoE（A14B）/ TI2V-5B、电影级 prompt 扩写、ComfyUI | [wan-integration](../skills/projects/wan-integration.md) | https://github.com/Wan-Video/Wan2.2 |

## Wan 系列（新增）

| 项目 | 典型用途 | 本地 / API |
|------|----------|------------|
| **Wan-skills** | `wan2.7-image` 分镜参考图、图像编辑；Skill 脚本可给 Agent 调用 | 需 `DASHSCOPE_API_KEY`（百炼） |
| **Wan2.2** | T2V、I2V、5B 一体 TI2V、S2V、角色 Animate；`prompt_extend` 电影级扩写 | 本地 `generate.py`（A14B 约需 80GB VRAM；TI2V-5B 可 4090）或 ComfyUI / DashScope 视频 API |

**ShopShot 已接入**（详见 [wan-integration.md](../skills/projects/wan-integration.md)）：

- `PromptAgent` + `wan_cinematic.py` — 借鉴 Wan2.2 扩写思路，经 Seed LLM 增强分镜 prompt  
- `WanImageClient` + `VisualAgent` — 无参考图时自动生成分镜图（可选）  
- `WanVideoClient` — Seedance 失败时的图生视频回退（可选，`WAN_VIDEO_ENABLED`）

主链路仍为 **Seed 剧本 → Seedance 视频**；Wan 为可选增强，不替代火山 EP。

## 说明

- **`ad_video_gen` 与 `ai-app-lab`** 均来自 [volcengine/ai-app-lab](https://github.com/volcengine/ai-app-lab)。`ad_video_gen` 使用 sparse-checkout 只拉 `demohouse/ad_video_gen`；`ai-app-lab` 只拉 `demohouse`，避免整库体积过大。
- sparse-checkout 后工作区路径为 `demohouse/...`；若需与历史目录结构一致，可将子目录内容上移或建立符号链接。
- 更新参考代码：进入对应目录执行 `git pull` 即可。
- 环境变量模板见根目录 `.env.example`（`DASHSCOPE_*`、`WAN_*` 等）。
