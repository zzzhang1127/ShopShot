# ShopShot

AI 驱动的电商带货视频一键生成平台。上传商品信息，AI 自动生成剧本、分镜与视频，让带货内容创作效率提升 10 倍。

## 功能特性

- **快捷模式**：输入商品信息，AI 直接生成带货视频
- **深度模式**：基于 AIDA 营销模型生成 4 镜分镜剧本，支持逐镜编辑后再生成视频
- **素材管理**：支持上传图片/视频素材作为 AI 生成参考
- **参数配置**：画面比例（9:16 / 16:9）、视频时长（**5 / 10 / 15 秒**，默认 15 秒）
- **7 大模板**：潮流服饰、美妆护肤、数码 3C、美食零食、家居生活、运动户外、珠宝配饰
- **多语言支持**：中文 / 英文一键切换
- **暗黑主题**：专业级视频创作 Studio UI
- **真实 API**：默认 `MOCK_MODE=false`，剧本走 Seed-2.0-pro，视频走 Seedance-1.5-pro

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | FastAPI、Hypercorn、SQLModel、SQLite |
| 前端 | React 19、TypeScript、Vite、Tailwind CSS v4 |
| AI | 火山方舟 Seed-2.0-pro（剧本）、Seedance-1.5-pro（视频） |
| 工具 | FFmpeg（拼接/裁切）、后台任务轮询 |

## 项目结构

```
ShopShot/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── api/v1/          # REST API
│   │   ├── agents/          # Director / Script / VideoGen / PostProcess
│   │   ├── workers/         # 后台异步任务
│   │   └── utils/           # Seed、Seedance、FFmpeg、下载等
│   ├── requirements.txt
│   └── run_server.py
├── frontend/
│   ├── src/
│   └── public/templates/    # 模板封面与示例
├── outputs/                 # 生成视频/素材（不提交 Git）
├── .env                     # 本地配置（根目录唯一，不提交 Git）
├── .env.example             # 环境变量模板（可提交）
├── Dockerfile               # 生产镜像（前端 + 后端 + FFmpeg）
├── docker-compose.yml       # 一键部署
├── docker-start.bat         # Windows Docker 快捷启动
├── start.bat                # 本地开发：前后端分离启动
└── scripts/                 # 冒烟 / E2E 测试脚本
```

---

## Docker 一键部署（推荐给他人的方式）

无需本机安装 Python / Node / FFmpeg，只要 **Docker Desktop**。

### 步骤

```bash
git clone <your-repo-url>
cd ShopShot
copy .env.example .env          # Windows；Linux/macOS: cp .env.example .env
# 编辑 .env，填入 VOLC_API_KEY、DOUBAO_SEED_EP、DOUBAO_SEEDANCE_EP

docker compose up -d --build
```

Windows 也可双击 **`docker-start.bat`**（会自动复制 `.env` 模板并提示编辑）。

| 地址 | 说明 |
|------|------|
| http://localhost:8000 | 前端 + API 同源 |
| http://localhost:8000/health | 健康检查 |
| `docker compose logs -f shopshot` | 查看容器日志 |
| `docker compose down` | 停止 |

- 数据库与生成视频保存在 Docker 卷 **`shopshot-data`**（路径 `/data`），删容器不丢数据。
- 修改端口：在 `.env` 设置 `SHOPSHOT_PORT=8080`（见 `docker-compose.yml`）。
- 容器内已固定 `DATABASE_URL=sqlite:////data/shopshot.db`、`STORAGE_LOCAL_PATH=/data/outputs`，会覆盖 `.env` 里的本地相对路径。

---

## 本地开发部署

### 1. 环境要求

| 依赖 | 版本建议 |
|------|----------|
| Python | 3.10+ |
| Node.js | 20+ |
| FFmpeg | 已加入系统 `PATH` |
| 火山方舟 | API Key + Seed / Seedance 端点 ID，账户有余额 |

### 2. 克隆与忽略本地文件

```bash
git clone <your-repo-url>
cd ShopShot
```

**不要提交、也不要从仓库拉取期望存在的文件：**

| 路径 | 说明 |
|------|------|
| `.env`（仅项目根目录） | API Key 与全部配置，仅本地 |
| `backend/shopshot.db`、`*.db` | SQLite 数据库 |
| `**/*.log`、`logs/`、`backend/e2e_server*.log` | 运行日志（**不必上传**） |
| `*.concat_list.txt`、`test_list.txt` | FFmpeg 临时列表（**不必上传**） |
| `outputs/` | 生成视频与上传素材 |
| `frontend/node_modules/`、`frontend/dist/` | 依赖与构建产物 |
| `*.mp4` / `*.jpg` 等 | 媒体二进制 |
| `auto_enter.py` | 个人自动化脚本 |
| `backend/test_scripts*.json` | 本地测试 JSON |

> `requirements.txt`、文档类 `.md` 等**需要提交**；`.gitignore` 只忽略日志、临时 txt、产物与密钥。

若你维护仓库且历史上误提交了 `server.log` / `shopshot.db`，见下文 [Git 提交指南](#git-提交指南)。

### 3. 环境变量（根目录唯一 `.env`）

在**项目根目录**复制模板并编辑（不要在 `backend/` 或 `frontend/` 下再建 `.env`）：

```bash
# 在 ShopShot 根目录执行
copy .env.example .env        # Windows
# cp .env.example .env        # Linux / macOS
```

将 `VOLC_API_KEY`、`DOUBAO_SEED_EP`、`DOUBAO_SEEDANCE_EP` 等改为真实值。完整字段见 [.env.example](.env.example)。

> 若你之前用过 `backend/.env`：把其中变量合并进根目录 `.env` 后删除 `backend/.env`，避免混淆。

在 [火山方舟控制台](https://console.volcengine.com/ark) 创建推理接入点，将 **Endpoint ID** 填入 `DOUBAO_SEED_EP` / `DOUBAO_SEEDANCE_EP`。

### 4. 安装依赖

```bash
cd backend
pip install -r requirements.txt

cd ../frontend
npm install
```

前端开发默认通过 Vite 代理访问后端（`vite.config.ts` 的 `envDir` 指向根目录，与后端读同一份 `.env`）。仅 Docker 等场景需在根目录 `.env` 取消注释：

```env
VITE_API_BASE=http://127.0.0.1:8000/api/v1
```

### 5. 启动

**Windows（需先把 `start_backend.bat` 里的 Python 路径改成你本机路径，或直接用命令行）：**

```bat
start.bat
```

**跨平台命令行：**

```bash
# 终端 1 - 后端 :8000
cd backend
python run_server.py

# 终端 2 - 前端 :5173
cd frontend
npm run dev
```

| 地址 | 说明 |
|------|------|
| http://localhost:5173 | 前端 |
| http://localhost:8000/api/v1/health | 健康检查（含 `mock_mode`） |
| http://localhost:8000/docs | Swagger |

### 6. 使用流程

1. 首页输入商品描述 → 创建项目  
2. 项目页上传商品图（可选）  
3. **深度模式**：生成剧本 → 编辑分镜 → 选择 **5/10/15 秒** → 生成视频  
4. 页面进度条轮询任务；成片在「最近生成」与素材库  

**快捷模式**：项目页切换快捷模式，一键走完整 Agent 流程。

### 7. 验证（可选）

```bash
# 后端已启动后
test_e2e.bat
# 或
python scripts/e2e_home_api_test.py
```

---

## 常见问题

| 现象 | 处理 |
|------|------|
| 剧本 `Network Error` | 确认后端 8000 已启动；前端代理或 `VITE_API_BASE` 正确 |
| 视频 429 / RPM 超限 | 等待 1–2 分钟；同时只跑一个生成任务；增大 `SEEDANCE_MIN_SUBMIT_INTERVAL` |
| 红色占位小视频 | 旧 mock 产物；`MOCK_MODE=false` 后**重新生成**，勿用历史 `mock_*.mp4` |
| FFmpeg 报错 | 安装 FFmpeg 并加入 `PATH` |
| Windows 后端卡死 | 项目使用 Hypercorn，勿改用 uvicorn 多进程 |

---

## 配置说明

| 环境变量 | 说明 |
|---------|------|
| `VOLC_API_KEY` | 火山方舟 API Key |
| `DOUBAO_SEED_EP` | Seed-2.0-pro 端点 ID（剧本） |
| `DOUBAO_SEEDANCE_EP` | Seedance-1.5-pro 端点 ID（视频） |
| `MOCK_MODE` | 必须为 `false` 才走真实 API |
| `SEEDANCE_CONCURRENCY` | 建议 `1`，避免 RPM |
| `SEEDANCE_MIN_SUBMIT_INTERVAL` | 两次 submit 最小间隔（秒） |
| `STORAGE_LOCAL_PATH` | 相对 `backend/` 的 outputs 目录 |

---

## API 概览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/health` | GET | 健康检查 |
| `/api/v1/projects` | GET/POST | 项目 |
| `/api/v1/upload` | POST | 上传素材 |
| `/api/v1/scripts/generate` | POST | 生成剧本 |
| `/api/v1/agents/run` | POST | 启动完整工作流 |
| `/api/v1/generations/{id}/status` | GET | 任务进度 |

---

## Git 提交指南

### 建议提交（源码与模板）

```
.gitignore
.env.example
README.md
backend/app/
backend/requirements.txt
backend/run_server.py
frontend/src/
frontend/package.json
frontend/vite.config.ts
frontend/public/
start.bat
start_backend.bat
start_frontend.bat
run_e2e_test.bat
test_e2e.bat
scripts/
```

### 切勿提交

- 密钥：根目录 `.env`
- 数据库：`backend/shopshot.db`
- 日志与临时文本：`*.log`、`*.concat_list.txt`、`test_list.txt`
- 产物：`outputs/`、`frontend/dist/`、`frontend/node_modules/`
- 旧环境文件：`backend/.env`、`frontend/.env*`（应删除，仅用根目录 `.env`）
- 个人脚本：`auto_enter.py`
- 大体积测试 JSON：`backend/test_scripts*.json`

### 推荐 Git 命令（在本机执行）

**第一步：从 Git 索引移除误跟踪文件（不删除磁盘文件）**

```powershell
cd D:\FILE\ShopShot

git rm --cached auto_enter.py
git rm --cached backend/server.log
git rm --cached backend/shopshot.db
```

**第二步：确认 `.gitignore` 已更新后，只添加应提交的变更**

```powershell
git add .gitignore .env.example README.md
git add backend/app/ backend/requirements.txt backend/run_server.py
git add frontend/src/ frontend/package.json frontend/vite.config.ts
git add frontend/package-lock.json
git add frontend/public/
git add Dockerfile docker-compose.yml docker-start.bat .dockerignore
git add start.bat start_backend.bat start_frontend.bat
git add run_e2e_test.bat test_e2e.bat scripts/
```

> 若 `package-lock.json` 不存在，去掉对应一行即可。`git add frontend/` 会遵守 `frontend/.gitignore`，不会带上 `node_modules` / `dist`。

**第三步：检查暂存区（确认没有 .env、db、log、outputs）**

```powershell
git status
git diff --cached --name-only
```

**第四步：提交**

```powershell
git commit -m "feat: real API workflow, rate limiting, and deployment docs

- Async jobs, Seedance RPM backoff, and frontend progress UI
- Tighten .gitignore; stop tracking db, logs, and outputs
- README: setup guide and Git commit instructions"
```

**第五步：推送（需要时）**

```powershell
git push origin HEAD
```

### 查看某文件是否被忽略

```powershell
git check-ignore -v .env outputs/videos/foo.mp4
```

---

## 注意事项

1. **Windows**：`start_backend.bat` 内 Python 路径需按本机修改，或直接用 `python run_server.py`。
2. **Seed-2.0-pro** 用于文本剧本，非生图；生图需另配 Seedream。
3. **账户余额**：Seedance 按量计费，深度模式一次会连续提交多个分镜任务。
4. **历史红屏视频**：仓库 `.gitignore` 已忽略 `*.mp4`，旧 mock 文件仅留在本机 `outputs/`，重新生成即可。
