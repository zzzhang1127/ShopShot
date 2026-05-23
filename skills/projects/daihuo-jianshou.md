---
name: daihuo-jianshou
id: 5f6a7b8c-9d0e-6f7a-8b9c-0d1e2f3a4b5c
description: 带货能手（daihuo-jianshou）项目可复用技术/思路速查。面向电商 AIGC 视频生成比赛，提炼其“多模型聚合策略、剧本模板体系、4 大视频模式、A/B 测试与批量生成”中可直接复用的业务方案。
---

# 带货能手项目可复用速查

## 一句话定位
面向抖音/快手/小红书的 AI 电商视频生成器。Next.js 16 + SQLite + Drizzle + Zustand + FFmpeg。核心能力：多模型聚合生成、5 大品类 × 4 种风格剧本模板、4 大视频模式、SEO 平台优化、批量生成与 A/B 测试。

## 可复用技术栈（按比赛 P0/P1 映射）

| 技术点 | daihuo-jianshou 实现 | 比赛借鉴点 | 优先级 |
|---|---|---|---|
| 前端框架 | Next.js 16 + React 19 + TypeScript 5 + Tailwind 4 + shadcn/ui | 与比赛推荐技术栈（React + TS + Tailwind + ShadcnUI）100% 对齐 | P0 |
| 数据库 | SQLite + Drizzle ORM | 比赛 Demo 期推荐 SQLite，Drizzle 类型安全且轻量 | P0 |
| 状态管理 | Zustand | 比赛推荐状态方案，全局管理生成任务、素材库、用户草稿 | P0 |
| 视频处理 | FFmpeg (wasm / server-side) | 后处理：分辨率转换、多画幅导出（9:16 / 16:9）、视频压缩 | P0 |
| 多模型聚合 | fal.ai / 火山 Seedance / 阿里万相 / Atlas Cloud / Silicon Flow | 比赛“视频创作”模块：主链路走 Seedance，fallback 到其他模型保证可用性 | P1 |
| 剧本模板 | 5 品类（美妆/3C/食品/服饰/家居）× 4 风格（促销/种草/剧情/品牌） | 比赛“灵感模板”直接复用此矩阵，扩展为 n 品类 × m 风格 | P0 |
| 视频模式 | 商品特写 / 图文混剪 / 场景演示 / 真人出镜 | 比赛“一键成片”的 4 条动线，商家按商品类型选择 | P0 |
| SEO 优化 | 按平台（抖音/快手/小红书）自动优化标题/标签/文案 | 比赛若涉及多平台分发，可复用平台适配逻辑 | P1 |
| A/B 测试 | 同商品生成多版视频，对比数据表现 | 比赛 P1/P2 加分项“生成因子 × 转化效果”归因 | P1 |
| 批量生成 | 一次选择多个商品/模板，队列批量产出 | 比赛 P1 进阶功能 | P1 |

## 核心流程可借鉴

```
商家选择商品 → 选择视频模式（特写/混剪/场景/真人）
  → 选择/自动生成剧本模板（品类 × 风格矩阵）
  → 多模型聚合生成视频素材（主链路 Seedance）
  → FFmpeg 后处理（拼接/转码/加字幕/多画幅导出）
  → 预览 → A/B 测试投放 → 数据回流
```

**比赛适配建议：**
- 这是最贴合比赛主题的参考项目。建议**优先复用其前端架构和剧本模板体系**。
- 多模型聚合可作为 P1 加分项，但 P0 阶段先保证 Seedance 单链路跑通。
- A/B 测试和数据看板用 mock 数据实现，重点展示“因子 × 效果”归因逻辑。

## 关键代码模式

### 1. 多模型聚合路由
```typescript
// 根据策略选择模型提供商
async function generateVideo(request: GenerateRequest): Promise<string> {
  const { mode, product, priority } = request;

  // 优先级：质量 > 速度 > 成本
  const providers = priority === 'quality'
    ? ['seedance', 'wanxiang', 'fal']
    : priority === 'speed'
    ? ['silicon-flow', 'seedance']
    : ['seedance'];

  for (const provider of providers) {
    try {
      return await callProvider(provider, request);
    } catch (err) {
      logger.warn(`${provider} failed, trying next...`);
      continue;
    }
  }
  throw new Error('All providers failed');
}
```
*比赛 P1：主模型失败时自动降级，保证端到端可用。*

### 2. 剧本模板矩阵
```typescript
interface ScriptTemplate {
  id: string;
  category: 'beauty' | '3c' | 'food' | 'fashion' | 'home';
  style: 'promotion' | 'grass' | 'story' | 'brand';
  hook: string;           // 开场钩子模板
  structure: Shot[];      // 分镜结构
  bpm: number;            // 推荐 BGM 节奏
  platformOptimized: Record<Platform, PlatformMeta>;
}

const TEMPLATES: ScriptTemplate[] = [
  {
    id: 'beauty-grass-01',
    category: 'beauty',
    style: 'grass',
    hook: '姐妹们，我发现了一个宝藏单品...',
    structure: [
      { type: 'hook', duration: 3, visual: '手持产品特写' },
      { type: 'demo', duration: 5, visual: '上脸前后对比' },
      { type: 'cta', duration: 2, visual: '价格标签+购买引导' }
    ],
    platformOptimized: {
      douyin: { tags: ['#美妆种草', '#平价好物'], ratio: '9:16' },
      xiaohongshu: { tags: ['#护肤分享', '#好物推荐'], ratio: '3:4' }
    }
  }
];
```
*比赛“灵感模板”核心数据结构。*

### 3. 多画幅导出（FFmpeg）
```bash
# 竖版 9:16 1080p
ffmpeg -i input.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -c:a copy output_9_16.mp4

# 横版 16:9 1080p
ffmpeg -i input.mp4 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" -c:a copy output_16_9.mp4
```
*比赛“预览与导出”模块：适配不同分发渠道。*

## 关键路径速查

| 相对路径 | 类/函数/组件 | 用途 |
|---|---|---|
| `src/app/api/ai/video/route.ts` | `POST`, `createProvider()`, `provider.generateVideo()` | 多模型聚合生视频：fal.ai / Seedance / 万相 / Atlas / Silicon Flow |
| `src/app/api/ai/image/route.ts` | `POST` | 多模型生图 |
| `src/app/api/ai/status/route.ts` | `POST` | 查询异步任务状态 |
| `src/app/api/llm/script/route.ts` | `POST` | LLM 生成剧本脚本 |
| `src/app/api/upload/route.ts` | `POST` | 素材上传接口 |
| `src/app/api/project/[id]/route.ts` | `GET` / `PATCH` / `DELETE` | 项目 CRUD |
| `src/app/project/[id]/video/page.tsx` | `VideoPage`, `VideoClipItem`, `ComposeConfig` | 视频合成页：时间线 + 合成设置（TTS/BGM/字幕/比例/分辨率） |
| `src/app/project/[id]/script/page.tsx` | `ScriptPage` | 剧本编辑页：模板选择、分镜编辑 |
| `src/app/project/[id]/assets/page.tsx` | `AssetsPage` | 素材管理页：上传、预览、选择 |
| `src/app/project/[id]/export/page.tsx` | `ExportPage` | 导出页：多画幅/多分辨率导出 |
| `src/app/batch/page.tsx` | `BatchPage` | 批量生成页：多商品/多模板队列 |
| `src/app/products/page.tsx` | `ProductsPage` | 商品库页 |
| `src/lib/providers` | `createProvider()` | 提供商工厂：统一封装各模型差异 |
| `src/lib/db/schema.ts` | `Shot` type, schema definitions | 数据库 Schema：project、shot、asset 等表 |
| `src/components/ui/` | shadcn/ui 组件 | UI 组件库（Button、Card、Select、Badge 等） |

## 踩坑与避坑

| 坑点 | 原因 | 比赛规避 |
|---|---|---|
| 多模型接口差异大 | 各模型参数/返回格式不统一 | 做一层统一抽象（参考上方多模型路由），内部适配各模型差异 |
| 真人出镜模式成本高 | 需要数字人/实拍素材 | 比赛先做“商品特写+图文混剪+场景演示”三种纯 AI 模式，真人出镜作为 P2 |
| SQLite 并发写锁 | 多任务同时更新状态会阻塞 | 任务状态更新用“队列串行化”或迁移到 PostgreSQL |
| 模板同质化严重 | 大量商家用同一模板 | 引入 LLM 对模板做“因子级微创新”（替换卖点话术/视觉风格） |

## 一句话总结
daihuo-jianshou 最值钱的是**“多模型聚合的容错设计 + 品类×风格模板矩阵 + 平台化 SEO 适配”**。它是 8 个参考项目中与比赛主题贴合度最高的，建议优先深度借鉴其业务架构和数据模型。
