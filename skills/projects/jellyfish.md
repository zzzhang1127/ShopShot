---
name: jellyfish
id: 70e4e4ea-845d-476a-87f0-dab1b7f84c73
description: Jellyfish 项目可复用技术/思路速查。面向电商 AIGC 视频生成比赛，提炼其“异步任务中心 + 素材一致性管理 + 前后端分离架构”中可借鉴的工程化方案。
---

# Jellyfish 项目可复用速查

## 一句话定位
AI 短剧生产平台。React + Vite 前端，FastAPI 后端，围绕“剧本理解 → 分镜拆解 → 角色/场景一致性 → 生成执行 → 统一异步任务中心”构建完整工作流。

## 可复用技术栈（按比赛 P0/P1 映射）

| 技术点 | Jellyfish 实现 | 比赛借鉴点 | 优先级 |
|---|---|---|---|
| 前后端分离 | React + Vite + FastAPI + Docker Compose | 比赛建议 Next.js API Routes 或 Node.js；若团队有 Python 背景，FastAPI 也是好选择 | P0 |
| 异步任务中心 | 统一任务队列（生成任务状态机：queued/running/succeeded/failed） | 直接映射 Seedance 异步任务，支持批量提交、进度追踪、失败重试 | P0 |
| 素材一致性 | 角色/场景/道具/服装独立资产库 + ID 关联 | 比赛“素材库”模块：商品主图/切片统一管理，保证多镜头调用时商品外观一致 | P0 |
| 存储层 | MySQL + Redis + RustFS (对象存储) | 开发期可简化为 SQLite + 本地磁盘；Redis 用于任务队列/缓存 | P1 |
| OpenAPI 生成 | 后端 FastAPI 自动生成 OpenAPI spec，前端生成 TS client | 保持前后端接口类型安全，减少联调成本 | P1 |
| Docker 部署 | docker-compose 一键启动前后端+数据库 | 比赛交付需要 Demo 可访问，Docker 化是加分项 | P2 |

## 核心流程可借鉴

```
剧本上传 / 创建
  → 剧本理解（LLM 提取角色、场景、情节线）
  → 分镜拆解（自动拆成多个 shot，每个 shot 绑定角色/场景/动作描述）
  → 资产一致性确认（角色脸模锁定、场景风格锁定）
  → 批量提交生成任务（每个 shot 一个异步任务）
  → 统一任务中心轮询进度
  → 合成完整剧集
```

**比赛适配建议：**
- 将“角色/场景一致性”映射为“商品/切片一致性”。确保同一商品在不同分镜中外观、尺寸、颜色一致。
- 将“分镜拆解”直接用于剧本模块的分镜脚本生成。
- 统一任务中心是 Seedance 多任务并发（批量生成）的必备基础设施。

## 关键代码模式

### 1. 异步任务状态机（后端）
```python
class TaskStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    EXPIRED = "expired"

class GenerationTask(BaseModel):
    id: str
    status: TaskStatus
    type: str  # "seedance_text2video" / "seedance_img2video"
    payload: dict
    result: Optional[dict] = None
    error_msg: Optional[str] = None
    created_at: datetime
    updated_at: datetime
```
*比赛后端可直接复用此模型，与 Seedance 原生状态流转对齐。*

### 2. 批量任务提交 + 并发控制
```python
async def batch_submit(tasks: list[dict], max_concurrent: int = 3):
    semaphore = asyncio.Semaphore(max_concurrent)
    async def submit_one(task):
        async with semaphore:
            return await seedance_create_task(task)
    return await asyncio.gather(*[submit_one(t) for t in tasks])
```
*Seedance 实测 3~5 条并发可行，此模式直接复用。*

### 3. 素材资产 ID 引用（避免冗余存储）
```json
{
  "shot_id": "s_001",
  "product_id": "prod_123",
  "slice_ids": ["slice_a", "slice_b"],
  "prompt": "特写镜头，展示 slice_a 的材质纹理，柔和自然光"
}
```
*分镜脚本不存图片本身，只存资产 ID。生成时再按 ID 召回 base64 或 URL。*

## 关键路径速查

| 相对路径 | 类/函数 | 用途 |
|---|---|---|
| `backend/app/main.py` | `app` (FastAPI), `lifespan`, `http_exception_handler`, `validation_exception_handler` | 应用入口：CORS、统一错误响应 `{code, message, data}`、路由挂载 |
| `backend/app/api/v1/routes/film/task_status.py` | `list_tasks()`, `get_task_status()`, `get_task_result()`, `cancel_task()`, `adopt_task_link()` | 任务中心 CRUD + 状态轮询 + 取消 + 采用状态变更 |
| `backend/app/api/v1/routes/film/` | `generated_video.py`, `video_request.py`, `tasks_images.py` | 影视生成相关路由（视频/图片任务提交） |
| `backend/app/api/v1/routes/studio/` | `shots.py`, `chapters.py`, `timeline.py`, `prompts.py`, `entities.py` | 工作室路由：分镜、章节、时间轴、提示词、实体资产 |
| `backend/app/core/task_manager/` | `SqlAlchemyTaskStore`, `TaskStatus` | 任务状态机与存储：queued/running/succeeded/failed/cancelled |
| `backend/app/models/task_links.py` | `GenerationTaskLink`, `GenerationTaskLinkStatus` | 任务关联表：绑定生成任务与业务实体（shot/prop/scene 等） |
| `backend/app/tasks/execute_task.py` | `revoke_task_execution()` | 任务执行与撤销 |
| `backend/app/bootstrap.py` | `bootstrap_all_registries()` | 启动初始化：供应商注册、执行器注册 |
| `backend/app/dependencies.py` | `get_db` | FastAPI Dependency：获取 AsyncSession |
| `backend/app/schemas/common.py` | `ApiResponse`, `success_response()`, `paginated_response()` | 统一响应包装 |
| `front/` | React + Vite 前端 | 前端项目目录（独立） |
| `deploy/` | Docker Compose 配置 | 一键部署前后端+数据库 |

## 踩坑与避坑

| 坑点 | 原因 | 比赛规避 |
|---|---|---|
| RustFS 部署复杂 | 对象存储自建成本高 | 比赛 Demo 期用本地磁盘 + 相对路径，或直接用 TOS/MinIO |
| 多角色一致性难以保证 | AI 生图/生视频角色漂移 | 比赛聚焦“商品”，商品一致性通过“同一组主图切片”保证，比人脸更容易 |
| 短剧分镜数量大（几十镜） | 总耗时长、成本高 | 电商视频 15s 以内，分镜 3~5 个即可，天然轻量 |

## 一句话总结
Jellyfish 最值钱的是**“统一异步任务中心 + 素材资产一致性管理”**。前者解决 Seedance 长任务排队与进度追踪问题，后者解决多镜头调用同一商品时的素材对齐问题。
