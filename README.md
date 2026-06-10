# ShopShot

> AI 驱动的电商带货视频一键生成平台。上传商品图片 + 一句话描述，AI 自动完成剧本撰写、分镜规划、视频生成、人声配音、BGM 混音，数分钟内产出专业级带货短视频。

---

## 功能特性

| 功能 | 说明 |
|------|------|
| **多模态剧本生成** | 上传商品图片，Seed-2.0-pro 识别商品外观并流式输出带货文案（SSE 实时展示） |
| **AIDA 分镜规划** | 基于营销模型自动生成 4 镜分镜方案（注意→兴趣→欲望→行动），支持逐镜手动编辑 |
| **AI 视频生成** | 每个分镜独立调用 Seedance-1.5-pro 图生视频，支持 5 / 10 / 15 / 20 秒时长和 9:16 / 16:9 / 1:1 画幅 |
| **TTS 人声配音** | 集成 Edge-TTS，支持 5 种中文神经网络音色，分镜有台词时自动合成人声 |
| **BGM 智能匹配** | 内置 4 种风格曲库（活力/轻柔/商务/潮流），支持自定义上传；无配置时自动选取默认 BGM |
| **全自动后处理** | FFmpeg 流水线完成拼接、音轨对齐、时长适配、BGM 混音，每个分镜和完整成片均含人声 + BGM |
| **实时进度追踪** | 顶部置顶进度条，平滑动画 + 分步提示，支持取消任务 |
| **素材库管理** | 商品图、参考视频、生成分镜统一管理，支持跨项目复用 |
| **一键部署** | Docker 镜像打包前端 + 后端 + FFmpeg，`docker compose up` 即可运行 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19、TypeScript、Vite、Tailwind CSS v4 |
| 后端 | FastAPI、Hypercorn、SQLModel、SQLite |
| AI 剧本 | 火山方舟 Seed-2.0-pro（多模态 + 流式输出） |
| AI 视频 | 火山方舟 Seedance-1.5-pro（图生视频） |
| 语音合成 | Microsoft Edge-TTS |
| 音视频处理 | FFmpeg |
| 部署 | Docker + Docker Compose |

---

## 项目结构

```
ShopShot/
├── backend/
│   ├── app/
│   │   ├── agents/          # Director / Script / VideoGen / PostProcess Agent
│   │   ├── api/v1/          # REST API 路由
│   │   ├── services/        # 业务逻辑层
│   │   ├── utils/           # Seed、Seedance、FFmpeg、TTS、下载工具
│   │   ├── workers/         # 后台异步任务
│   │   └── prompts/         # AIDA 分镜提示词模板
│   ├── static/bgm/          # 内置 BGM 曲库
│   ├── requirements.txt
│   └── run_server.py
├── frontend/
│   ├── src/
│   │   ├── components/studio/  # Block1~4 四个工作台板块
│   │   ├── pages/              # 首页、项目列表、项目详情
│   │   └── api/client.ts       # API 请求封装
│   └── public/
├── outputs/                 # 生成视频与上传素材（不提交 Git）
├── .env                     # 本地环境变量（不提交 Git）
├── .env.example             # 环境变量模板
├── Dockerfile
├── docker-compose.yml
└── start.bat                # Windows 本地开发一键启动
```

---

## 快速开始

### 方式一：Docker 一键部署（推荐）

无需本机安装 Python / Node.js / FFmpeg，只需 **Docker Desktop**。

```bash
git clone https://github.com/zzzhang1127/ShopShot.git
cd ShopShot

# Windows
copy .env.example .env
# Linux / macOS
cp .env.example .env
```

编辑 `.env`，填入火山方舟的 `VOLC_API_KEY`、`DOUBAO_SEED_EP`、`DOUBAO_SEEDANCE_EP`，然后：

```bash
docker compose up -d --build
```

Windows 也可直接双击 **`docker-start.bat`**。

| 地址 | 说明 |
|------|------|
| http://localhost:8000 | 前端页面 + API 同源 |
| http://localhost:8000/health | 健康检查 |
| http://localhost:8000/docs | Swagger API 文档 |
| `docker compose logs -f shopshot` | 查看容器日志 |
| `docker compose down` | 停止服务 |

> 数据库和生成视频持久化在 Docker 卷 `shopshot-data`，删除容器不会丢失数据。

---

### 方式二：本地开发

#### 环境要求

| 依赖 | 版本 |
|------|------|
| Python | 3.10+ |
| Node.js | 20+ |
| FFmpeg | 已加入系统 `PATH` |
| 火山方舟账号 | 有余额，已创建 Seed / Seedance 推理接入点 |

#### 步骤

**1. 克隆并配置环境变量**

```bash
git clone https://github.com/zzzhang1127/ShopShot.git
cd ShopShot
copy .env.example .env   # Windows；Linux/macOS 用 cp
```

编辑根目录 `.env`，填入真实的 API Key 和 Endpoint ID（见下方[环境变量说明](#环境变量说明)）。

**2. 安装依赖**

```bash
# 后端
cd backend
pip install -r requirements.txt

# 前端
cd ../frontend
npm install
```

**3. 启动服务**

```bash
# Windows 一键启动
start.bat

# 或手动分开启动：
# 终端 1 - 后端（端口 8000）
cd backend && python run_server.py

# 终端 2 - 前端（端口 5173）
cd frontend && npm run dev
```

| 地址 | 说明 |
|------|------|
| http://localhost:5173 | 前端页面 |
| http://localhost:8000/api/v1/health | 后端健康检查 |
| http://localhost:8000/docs | Swagger |

---

## 环境变量说明

在[火山方舟控制台](https://console.volcengine.com/ark)创建 **Seed-2.0-pro** 和 **Seedance-1.5-pro** 的推理接入点，将 Endpoint ID 填入对应字段。

| 变量 | 必填 | 说明 |
|------|------|------|
| `VOLC_API_KEY` | ✅ | 火山方舟 API Key |
| `DOUBAO_SEED_EP` | ✅ | Seed-2.0-pro 端点 ID（剧本生成） |
| `DOUBAO_SEEDANCE_EP` | ✅ | Seedance-1.5-pro 端点 ID（视频生成） |
| `MOCK_MODE` | — | `false` 使用真实 API，`true` 返回占位数据 |
| `SEEDANCE_CONCURRENCY` | — | 并发视频生成数，建议 `1` 避免超 RPM |
| `SEEDANCE_MIN_SUBMIT_INTERVAL` | — | 两次提交最小间隔（秒），默认 `15` |
| `STORAGE_LOCAL_PATH` | — | 生成文件存储路径，默认 `../outputs` |

---

## 使用流程

```
1. 首页输入商品名称 → 新建项目

2. 板块 1：上传 1~4 张商品图片，填写商品描述
   → 点击「生成剧本」，AI 实时流式输出带货文案

3. 板块 2：确认/编辑剧本，设置视频时长和画面比例
   → 点击「生成分镜提示词」，AI 输出 4 镜 AIDA 画面描述

4. 板块 3：逐镜编辑提示词，配置 TTS 音色和 BGM（可选，不配置自动补充）
   → 点击「生成视频」启动完整流水线

5. 板块 4：顶部进度条实时追踪，约 3~5 分钟后：
   - 最终成片（人声 + BGM）
   - 4 个独立分镜视频（各含人声 + BGM）
   → 一键下载或发布到模板库
```

---

## API 概览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/health` | GET | 健康检查 |
| `/api/v1/projects` | GET / POST | 项目列表与创建 |
| `/api/v1/upload` | POST | 上传素材（图片/视频） |
| `/api/v1/scripts/generate` | POST | 生成剧本（同步） |
| `/api/v1/scripts/generate-from-images/stream` | POST | 多模态剧本生成（SSE 流式） |
| `/api/v1/shots` | GET / PUT | 分镜列表与编辑 |
| `/api/v1/agents/run` | POST | 启动完整视频生成流水线 |
| `/api/v1/generations/{id}/status` | GET | 任务进度查询 |
| `/api/v1/generations/{id}/cancel` | POST | 取消任务 |

完整接口文档见 http://localhost:8000/docs

---

## 常见问题

| 现象 | 解决方法 |
|------|---------|
| 剧本生成报 `Network Error` | 确认后端 8000 端口已启动；检查 `VITE_API_BASE` 配置 |
| 视频生成报 `429` | Seedance RPM 超限，等待 1~2 分钟；建议保持 `SEEDANCE_CONCURRENCY=1` |
| 生成视频无声音 | 确认 `MOCK_MODE=false`；重新生成（旧 mock 视频无音轨） |
| FFmpeg 命令报错 | 安装 FFmpeg 并加入系统 `PATH` |
| Windows 后端启动卡死 | 项目使用 Hypercorn 异步服务器，不要改用 uvicorn 多进程模式 |
| 422 参数错误 | 检查请求体是否包含所有必填字段，详见 `/docs` |

---

## License

MIT
