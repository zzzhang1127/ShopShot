# ShopShot 修复计划与避坑记录

## 1. 资源中心缺少 AppShell 侧边栏
**问题描述**：`/library`、`/videos`、`/audio`、`/templates` 等页面进入后是独立布局，体验和首页/项目列表不统一。
**修复方案**：将 `LibrariesPage.tsx` 的外层包裹上 `<AppShell>` 组件，使其与其他页面共享侧边栏导航。
**踩坑记录**：
- 之前可能因为资源中心页面结构比较独立，直接使用了全屏布局。引入 `AppShell` 时需要注意内部滚动区域的处理，确保内容不会溢出或被遮挡。

## 2. 项目列表状态不同步
**问题描述**：项目已提交视频生成，但列表仍显示 `draft`，没有及时变成 `generating`。
**修复方案**：
- 在 `backend/app/api/v1/agents.py` 中，当调用 `run_video_agent` 或 `run_quick_agent` 时，将 `project.status` 更新为 `ProjectStatus.GENERATING`。
- 在 `backend/app/agents/director.py` 中，当 `execute_video_only` 或 `execute_quick` 成功完成时，将 `project.status` 更新为 `COMPLETED`；如果发生异常，更新为 `FAILED`（或保持 `GENERATING` 并在前端展示错误）。
**踩坑记录**：
- 状态同步不仅依赖于前端轮询，还需要后端在关键节点（任务开始、任务结束）正确更新数据库中的 `Project` 状态。

## 3. 最终成片未落库 / 状态丢失
**问题描述**：项目已生成分镜视频 asset 和末帧图，但 `/videos?project_id=45` 仍为空，项目页「成片」区也为空。
**根因分析**：
- 经过排查，最终视频**确实已经生成并保存到了数据库**（状态为 `DRAFT`，这是正常的，前端会展示历史视频）。
- 真正的问题是**前端状态丢失**：当用户提交生成任务后离开 `ProjectDetail` 页面，然后再返回时，组件重新挂载，`task` 状态被重置为 `null`，导致前端**停止了对任务状态的轮询**。因此，虽然任务在后台完成了，但前端没有拉取到最新的视频列表。
**修复方案**：
- 在后端 `backend/app/api/v1/generations.py` 中增加一个 API：`GET /api/v1/generations/project/{project_id}/latest`，用于获取该项目最新的一条生成任务。
- 在前端 `ProjectDetail.tsx` 的 `load` 函数中，调用该 API 获取最新任务。如果任务状态是 `running` 或 `queued`，则将其设置为当前的 `task`，从而恢复轮询逻辑。
**踩坑记录**：
- 这是一个典型的 React 状态管理问题。对于长时间运行的后台任务，不能仅仅依赖组件内部的本地状态来维持轮询，必须在组件挂载时从后端恢复任务状态。

## 4. UX 体验优化
**问题描述**：页面杂乱，ComfyUI 需要自动尝试连接，滚动条样式不统一，提示词输入框太窄。
**修复方案**：
- **ComfyUI 自动连接**：在 `HomePage.tsx` 或 `ModelConfigPanel.tsx` 挂载时，自动调用 `getComfyHealth()` 尝试连接。
- **滚动条样式**：在 `index.css` 中添加 `::-webkit-scrollbar` 相关样式，使其与暗色主题匹配。
- **提示词输入框**：在 `CliprisePromptBar.tsx` 中，将 `textarea` 的 `resize-none` 改为 `resize-y`，并增加 `min-h`，允许用户上下拖拽调整高度。
**踩坑记录**：
- `textarea` 的拖拽调整大小功能在 Tailwind 中可以通过 `resize-y` 轻松实现，但需要注意外层容器的布局，避免撑破页面。

## 5. UI 细节与中文化优化 (Browser Subagent 发现)
**问题描述**：
1. 深度模式下分镜提示词显示为英文（`young office lady...`），用户希望看到中文。
2. 界面中存在大量未翻译的原始技术标识（如 `shot_1 (hook)`、`状态: draft`、`模式: product_show`、`任务: script` 等）。
3. 首页模板区存在像 Debug 信息的提示文本（`后台 Seed API 正在持续扩充...`），且数量统计文案（`共 595 个（目标 200）`）在超过目标时显得奇怪。
4. ComfyUI 的黄色提示框在每个项目页都显示，显得过于极客和杂乱。
5. 网页标题为英文 `ShopShot - AIGC Video Generator`。

**修复方案**：
1. **中文化枚举与状态**：在 `i18n.ts` 中增加状态（draft, running, succeeded, failed, completed）、模式（product_show, story 等）和任务类型（script, video, image）的翻译。
2. **分镜提示词显示**：在 `ProjectDetail.tsx` 的深度模式中，优先展示中文台词/旁白（`words`），将英文的画面和动作提示词折叠或弱化显示（例如加上“发送至 Seedance 的英文提示”的标题）。
3. **清理 Debug 信息**：移除或弱化首页模板区的 API 扩充进度提示，修改数量统计文案为 `已收录 {total} · 持续扩充中`。
4. **隐藏极客元素**：默认隐藏 ComfyUI 的未启用提示和 JSON 查看器，仅在需要时展开。
5. **更新网页标题**：修改 `index.html` 中的 `<title>` 为 `ShopShot - AI 视频创作`。
6. **翻译硬编码文本**：将 `Prompt 示例` 改为 `提示词示例`，将 `shot_1` 改为 `第 1 镜`。

**踩坑记录**：
- Seedance API 确实需要英文提示词以获得最佳效果，因此后端生成英文提示词是正确的逻辑。前端的挑战在于如何“藏拙”，即在向用户展示时提供中文的友好界面，而在底层发送英文 payload。
- 状态枚举的翻译需要确保覆盖所有可能的值，否则会回退到显示原始的英文枚举名。
