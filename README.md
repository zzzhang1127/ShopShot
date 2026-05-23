# ShopShot

AI 驱动的电商带货视频一键生成平台。上传商品信息，AI 自动生成剧本、分镜与视频，让带货内容创作效率提升 10 倍。

## 功能特性

- **快捷模式**：输入商品信息，AI 直接生成带货视频
- **深度模式**：基于 AIDA 营销模型生成 4 镜分镜剧本，支持逐镜编辑后再生成视频
- **素材管理**：支持上传图片/视频素材作为 AI 生成参考
- **参数配置**：画面比例（9:16 / 16:9）、视频时长（4s / 5s / 8s / 10s）自由调节
- **7 大模板**：潮流服饰、美妆护肤、数码 3C、美食零食、家居生活、运动户外、珠宝配饰
- **多语言支持**：中文 / 英文一键切换
- **暗黑主题**：专业级视频创作 Studio UI

## 技术栈

### 后端
- **FastAPI** - Python Web 框架
- **Hypercorn** - ASGI 服务器（Windows 兼容）
- **SQLAlchemy + SQLModel** - ORM 与数据模型
- **豆包 Seed-2.0-pro** - 剧本/分镜生成（LLM）
- **豆包 Seedance** - 视频生成
- **SQLite** - 本地数据库

### 前端
- **React 19** + **TypeScript**
- **Vite** - 构建工具
- **Tailwind CSS v4** - 样式
- **Lucide React** - 图标
- **React Router** - 路由

## 项目结构

```
ShopShot/
├── backend/                  # FastAPI 后端
│   ├── app/
│   │   ├── api/v1/           # API 路由 (agents, assets, generations, projects, scripts, shots, videos)
│   │   ├── agents/           # AI Agent (DirectorAgent, ScriptAgent, VideoGenAgent, PostProcessAgent)
│   │   ├── core/             # 数据库、存储、异常处理
│   │   ├── models/           # SQLModel 数据模型
│   │   ├── prompts/          # LLM 提示词 (AIDA 分镜剧本)
│   │   ├── schemas/          # Pydantic 数据校验
│   │   ├── services/         # 业务逻辑服务
│   │   └── utils/            # 工具 (SeedClient, SeedanceClient, FFmpeg)
│   ├── .env                  # 环境变量配置
│   ├── requirements.txt      # Python 依赖
│   └── run_server.py         # 启动入口 (Hypercorn)
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── pages/            # 页面 (HomePage, ProjectList, ProjectCreate, ProjectDetail)
│   │   ├── api/client.ts     # API 客户端
│   │   ├── lib/i18n.ts       # 国际化
│   │   └── types/            # TypeScript 类型
│   ├── public/templates/     # 模板视频与封面
│   └── package.json
├── start_backend.bat         # 后端启动脚本 (Windows)
└── start_frontend.bat        # 前端启动脚本 (Windows)
```

## 快速开始

### 环境准备

- Python 3.10+
- Node.js 20+
- FFmpeg（系统安装，用于视频拼接）
- 火山方舟 API Key（用于豆包模型调用）

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd ShopShot
```

### 2. 配置后端

创建 `backend/.env`：

```env
# 火山方舟 API 配置
VOLC_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VOLC_API_KEY=your-api-key
DOUBAO_SEED_EP=your-seed-endpoint       # Seed-2.0-pro
DOUBAO_SEEDANCE_EP=your-seedance-endpoint  # Seedance-1.5-pro

# 数据库
DATABASE_URL=sqlite:///./shopshot.db

# 存储
STORAGE_TYPE=local
STORAGE_LOCAL_PATH=../outputs

# 功能开关
IMAGE_GENERATION_ENABLED=false

# 任务并发
SEEDANCE_CONCURRENCY=3
SEEDANCE_POLL_INTERVAL=10

# 应用配置
APP_NAME=ShopShot
DEBUG=true
```

> 在 [火山方舟控制台](https://console.volcengine.com/ark) 获取 API Key 和模型端点。

安装依赖：

```bash
cd backend
pip install -r requirements.txt
```

### 3. 配置前端

```bash
cd frontend
npm install
```

### 4. 启动项目

**Windows**（双击运行）：

- `start_backend.bat` - 启动后端 (http://localhost:8000)
- `start_frontend.bat` - 启动前端 (http://localhost:5173)

**命令行**：

```bash
# 后端
cd backend
python run_server.py

# 前端（另开一个终端）
cd frontend
npm run dev
```

## 配置说明

| 环境变量 | 说明 |
|---------|------|
| `VOLC_API_KEY` | 火山方舟 API Key |
| `DOUBAO_SEED_EP` | 豆包 Seed-2.0-pro 端点 ID |
| `DOUBAO_SEEDANCE_EP` | 豆包 Seedance 视频生成端点 ID |
| `DATABASE_URL` | 数据库连接 URL |
| `STORAGE_LOCAL_PATH` | 本地存储路径 |
| `SEEDANCE_CONCURRENCY` | 视频生成并发数 |
| `SEEDANCE_POLL_INTERVAL` | 视频生成轮询间隔（秒）|

## API 概览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/projects` | GET/POST | 项目列表 / 创建项目 |
| `/api/v1/projects/{id}` | GET/PUT | 获取 / 更新项目 |
| `/api/v1/upload` | POST | 上传素材 |
| `/api/v1/scripts/generate` | POST | 生成剧本（深度模式）|
| `/api/v1/agents/run` | POST | 运行完整工作流 |
| `/api/v1/agents/run/{id}/quick` | POST | 快捷生成视频 |
| `/api/v1/agents/run/{id}/script` | POST | 仅生成剧本 |
| `/api/v1/agents/run/{id}/video` | POST | 仅生成视频 |
| `/api/v1/generations/{id}/status` | GET | 查询任务状态 |

## 注意事项

1. **Windows 兼容**：后端使用 `Hypercorn` 替代 `uvicorn` 以避免 Windows 上的 asyncio 死锁问题。
2. **Seed-2.0-pro 非生图模型**：该模型用于文本/剧本生成。如需 AI 生图功能，需在火山方舟开通 **Seedream** 模型并配置对应端点。
3. **剧本生成同步阻塞**：`POST /scripts/generate` 为同步调用，需等待 LLM 返回（约 10~30 秒），期间前端按钮显示"运行中..."。
4. **FFmpeg**：视频拼接依赖系统安装的 `ffmpeg`，请确保已加入系统 PATH。
5. **账户余额**：调用 Seedance 视频生成需火山方舟账户余额充足（建议 >= 200 元或已购资源包）。
