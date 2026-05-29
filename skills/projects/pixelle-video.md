---
name: pixelle-video
id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
description: 阿里 AIDC 开源 AI 全自动短视频引擎 Pixelle-Video。基于 Pipeline + ComfyUI 工作流编排，LLM 文案、TTS、生图/生视频、HTML 模板合成、FFmpeg/MoviePy 成片。含 Streamlit Web、FastAPI、素材驱动与数字人/图生视频/动作迁移扩展流水线。
---

# Pixelle-Video 可复用速查

## 一句话定位

**输入一个主题（或固定脚本）→ 自动产出带解说、配图/视频、字幕样式、BGM 的完整短视频。**  
不是 VeADK Multi-Agent 架构，而是 **「Pipeline 模板方法 + ComfyKit 原子能力」** 的可插拔流水线；Web 层用 Streamlit 多 Tab 注册不同 `PipelineUI`。

- 仓库：`projects/Pixelle-Video`（GitHub: `AIDC-AI/Pixelle-Video`）
- 许可：Apache-2.0
- Python：≥ 3.11，包管理推荐 **uv**

## 与 ShopShot / ad_video_gen 的差异

| 维度 | Pixelle-Video | ShopShot | ad_video_gen |
|------|---------------|----------|--------------|
| 编排 | Pipeline（线性模板方法） | Director + 少量 Agent | VeADK Multi-Agent |
| 视频 API | ComfyUI 工作流（WAN/FLUX 等） | 火山 Seedance HTTP | Seedance HTTP |
| 剧本 | 旁白句列表 + 分镜帧 | AIDA 四镜电商剧本 | AIDA + 评估抽卡 |
| 画面 | HTML 模板叠字幕 + 生图/视频 | 直连 Seedance 单镜 | Seedream + Seedance |
| 配音 | Edge-TTS / Index-TTS 等工作流 | 暂无（P1） | TTS 工具 |
| 定位 | 通用短视频/知识/营销 | 电商带货比赛 | 官方电商 Demo |

## 技术栈总览

| 层级 | 技术 | 说明 |
|------|------|------|
| 语言运行时 | Python 3.11+、AsyncIO | 全链路异步 Pipeline |
| Web UI | **Streamlit** | 多页面：`Home` 流水线 Tab、`History` 历史 |
| HTTP API | **FastAPI** + Uvicorn | `api/app.py`，任务、LLM/TTS/图/视频、文件 |
| 核心包 | `pixelle_video` | `PixelleVideoCore` 统一入口 |
| LLM | **OpenAI SDK 兼容** | GPT / 通义 / DeepSeek / Ollama 等 |
| 媒体生成 | **ComfyKit** → ComfyUI | 工作流 JSON 驱动 TTS、生图、生视频 |
| 云端 GPU | **RunningHub** | `workflows/runninghub/*.json`，免本地 ComfyUI |
| 本地 GPU | **selfhost** | `workflows/selfhost/*.json`，连 `127.0.0.1:8188` |
| 视频合成 | **MoviePy**、ffmpeg-python | 分镜拼接、BGM 混音 |
| 模板渲染 | **HTML 模板** + Pillow | `templates/{分辨率}/*.html`，字幕与版式 |
| 配置 | **YAML** `config.yaml` | LLM / ComfyUI / 默认工作流 / 模板 |
| 任务持久化 | `PersistenceService` + `HistoryManager` | 任务目录、历史列表、复现 |
| 可选 | Playwright、BeautifulSoup | 素材分析、页面抓取类扩展 |
| 部署 | Docker、`packaging/windows` | 整合包、docker-start.sh |

## 核心方法：Pipeline 模板方法

所有主流程继承 `LinearVideoPipeline`（`pixelle_video/pipelines/linear.py`），生命周期固定为：

```
setup_environment → generate_content → determine_title → plan_visuals
→ initialize_storyboard → produce_assets → post_production → finalize
```

状态集中在 `PipelineContext`（旁白列表、image_prompts、storyboard、task_dir 等）。

### 内置 Pipeline（`pixelle_video`）

| Pipeline | 类 | 输入 | 方法要点 |
|----------|-----|------|----------|
| **standard** | `StandardPipeline` | 主题或固定文稿 | `mode=generate`：LLM 生成 n 条旁白；`mode=fixed`：按段/行/句切分；每帧 TTS→生图/视频→模板合成→拼接→可选 BGM |
| **asset_based** | `AssetBasedPipeline` | 用户图片/视频 + 意图 | 分析素材 → LLM 写分场景脚本并匹配素材路径 → 不 AI 生图，直接合成 |
| **custom** | `CustomPipeline` | 自定义 | 继承模板，供二次开发 |

### 单帧处理（`FrameProcessor`）

每镜 `StoryboardFrame` 顺序执行：

1. **TTS**（ComfyKit 工作流，如 `tts_edge.json`）
2. **生图或生视频**（`MediaService`，按模板类型 `image_*` / `video_*`）
3. **帧合成**（HTML 模板 + 字幕）
4. **生成该镜视频片段**（音画时长由 TTS 驱动，避免硬裁切）

关键设计：**音频时长传给视频工作流**，保证音画同步。

### Web 层 PipelineUI（`web/pipelines/`）

Streamlit 侧注册名与后端 `pixelle_video.generate_video(pipeline=...)` 对应：

| UI 注册名 | 文件 | 能力 |
|-----------|------|------|
| `quick_create` | `standard.py` | 经典三栏：文案/风格/预览 |
| `asset_based` | `asset_based.py` | 上传素材营销片 |
| `digital_human` | `digital_human.py` | 数字人口播 |
| `i2v` | `i2v.py` | 图生视频 |
| `action_transfer` | `action_transfer.py` | 动作迁移（参考视频+图片） |

注册机制：`register_pipeline_ui` → `get_all_pipeline_uis()`，首页 Tab 切换。

## 标准成片流程（Standard）

```
用户主题/脚本
  → LLM 生成标题 + 旁白列表（或切分固定脚本）
  → LLM 为每句生成 image_prompt
  → 初始化 Storyboard（帧列表 + StoryboardConfig：模板、比例、工作流名）
  → 对每一帧 FrameProcessor：
        TTS → Media(图/视频) → HTML 模板出图 → 单镜 mp4
  → VideoService 拼接全部分镜
  → 可选 BGM 混音
  → 写入 task 目录 + HistoryManager 记录
```

## ComfyUI 工作流体系

- 目录：`workflows/selfhost/`、`workflows/runninghub/`
- 命名约定：`image_*.json`、`video_*.json`、`tts_*.json`
- 配置项（`config.yaml`）：
  - `comfyui.comfyui_url` / `comfyui_api_key`（本地）
  - `comfyui.runninghub_api_key` / `runninghub_concurrent_limit`（云端）
  - `comfyui.tts.default_workflow`
  - `comfyui.image.default_workflow`、`comfyui.video.default_workflow`
- 预置示例：FLUX 生图、WAN 2.1 图生视频、Edge-TTS、Index-TTS、数字人、动作迁移等

**扩展方式**：ComfyUI 导出 JSON → 放入 `workflows/` → Web/API 选择工作流名。

## HTML 视觉模板

- 路径：`templates/1080x1920/`、`1920x1080/`、`1080x1080/` 等
- 命名：
  - `static_*.html`：静态样式，不依赖 AI 生媒体
  - `image_*.html`：需要 AI 生图
  - `video_*.html`：需要 AI 生视频（常配 WAN）
- 配置：`template.default_template`，如 `1080x1920/image_default.html`

## 配置与启动

```bash
cd projects/Pixelle-Video
cp config.example.yaml config.yaml
# 填写 llm.api_key / base_url / model
# 填写 comfyui.runninghub_api_key 或 comfyui_url

uv sync
uv run streamlit run web/app.py    # Web UI
uv run python api/app.py          # FastAPI（可选）
```

Docker：`docker compose up` / `docker-start.sh`。

## 关键路径速查

| 路径 | 用途 |
|------|------|
| `pixelle_video/service.py` | `PixelleVideoCore`：llm / tts / media / video / pipelines |
| `pixelle_video/pipelines/standard.py` | 默认主题→成片 |
| `pixelle_video/pipelines/linear.py` | 模板方法基类 + `PipelineContext` |
| `pixelle_video/services/frame_processor.py` | 单帧 TTS→图/视频→合成 |
| `pixelle_video/services/media.py` | ComfyKit 生图/生视频 |
| `pixelle_video/services/video.py` | 分镜拼接、BGM |
| `pixelle_video/utils/content_generators.py` | 标题/旁白/分镜 prompt 生成 |
| `pixelle_video/services/history_manager.py` | 历史任务列表、删除、复现 |
| `web/pages/1_🎬_Home.py` | Streamlit 主页 |
| `web/pages/2_📚_History.py` | 历史页 |
| `api/app.py` | FastAPI 入口 |
| `api/tasks/` | 异步任务管理 |
| `workflows/` | ComfyUI JSON |
| `templates/` | 帧 HTML 模板 |

## 对 ShopShot 的可借鉴点

1. **Pipeline 模板方法**：比单文件 Director 更易加「素材驱动成片」分支（对应比赛的素材库模式）。
2. **HTML 模板字幕层**：电商字幕/贴纸可在后处理单独一层，不必全塞进 Seedance prompt。
3. **TTS 驱动镜长**：每镜时长跟旁白走，再调 Seedance duration，减少 FFmpeg 硬拉伸。
4. **HistoryManager + 任务目录**：`task_id` 隔离输出，历史复现/重新生成可对齐 ShopShot「生成历史」。
5. **RunningHub**：无本地 GPU 时仍可跑 WAN/FLUX，类似纯 API 部署。
6. **asset_based 流水线**：用户上传商品图→LLM 匹配分镜，与 ShopShot 深度模式 + 素材栏一致。

## 不宜直接照搬

- 重度依赖 **ComfyUI 工作流**，与 ShopShot **火山 Seed/Seedance HTTP** 栈不同；借鉴流程思想即可。
- 主路径是 **旁白+配图** 知识短视频，不是 AIDA 四镜电商固定结构。
- Streamlit 与 React 前端技术栈不同，仅参考信息架构（三栏、历史页、多流水线 Tab）。

## 触发本 Skill 的场景

- 用户提到 Pixelle-Video、ComfyKit、RunningHub 短视频方案
- 需要设计 TTS+模板合成+分镜拼接流水线
- 对比 ShopShot 与开源全自动短视频项目的架构差异
- 扩展「自定义素材」「数字人」「图生视频」模块
