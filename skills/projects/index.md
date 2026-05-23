# 参考项目技能索引

本目录收录 9 个参考项目的可复用技术/思路速查，按与比赛主题贴合度排序：

1. **[ad-video-gen](ad-video-gen.md)** — **最核心**。火山官方电商视频 Multi-Agent 系统。VeADK A2A 协作、导演 Agent（AIDA 分镜/生图/生视频）、评估 Agent 抽卡择优、Hook 容错。**最终效果必须依靠 Agent**。
2. **[daihuo-jianshou](daihuo-jianshou.md)** — 最贴合比赛业务。多模型聚合、剧本模板矩阵、4 大视频模式、A/B 测试、批量生成。
3. **[seedance-chain](seedance-chain.md)** — Seedance 链式续拍核心技术。首尾帧衔接、样片模式、批量并发、FFmpeg 合并。
4. **[adgen](adgen.md)** — 前端架构标杆。Next.js 15 + Zustand + React Query + Remotion 预览 + URL 自动抓取。
5. **[ai-app-lab](ai-app-lab.md)** — 火山官方生态。Arkitect SDK、ad_video_gen 归属地、视频理解、RTC 实时对话。
6. **[moneyprinterplus](moneyprinterplus.md)** — 批量混剪与配音。多提供商 TTS、30+ 转场、自动发布、BGM 混合。
7. **[video-cut-agent](video-cut-agent.md)** — Agent 编排与后处理。LangChain 工具链、MoviePy 合成、音频混音、beat detection。
8. **[jellyfish](jellyfish.md)** — 工程化架构。异步任务中心、素材一致性管理、前后端分离、Docker 部署。
9. **[awesome-ai-video-generator-prompts](awesome-ai-video-generator-prompts.md)** — Prompt 工程。结构化公式、运镜/灯光/风格词典、电商垂直模板。

## 按比赛模块速查

| 比赛模块 | 优先参考项目 |
|---|---|
| 前端架构 / 状态管理 / 任务进度 | adgen, daihuo-jianshou |
| 素材库 / 结构化 / 检索 | jellyfish, video-cut-agent, ai-app-lab |
| 剧本生成 / 模板 / 爆款仿写 | ad-video-gen, daihuo-jianshou, awesome-ai-video-generator-prompts |
| 视频创作 / 一键成片 / 分镜干预 | ad-video-gen, seedance-chain, daihuo-jianshou, adgen |
| 智能剪辑 / 字幕 / 配音 / BGM | moneyprinterplus, video-cut-agent |
| 后处理 / 多画幅导出 / FFmpeg | seedance-chain, daihuo-jianshou, moneyprinterplus |
| **Agent 编排 / Multi-Agent** | **ad-video-gen**, video-cut-agent, ai-app-lab |
| 评估抽卡 / 质量择优 | ad-video-gen |
| A/B 测试 / 数据看板 | daihuo-jianshou |
