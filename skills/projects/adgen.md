---
name: adgen
id: a1a25633-e064-4d89-9a97-3e273a8e520d
description: AdGen 项目可复用技术/思路速查。面向电商 AIGC 视频生成比赛，提炼其“URL 抓取 → LLM 剧本 → 客户端视频合成”链路中可借鉴的前端架构、状态管理、声明式视频渲染方案。
---

# AdGen 项目可复用速查

## 一句话定位
用 Next.js 15 全家桶 + Puppeteer 抓取 + GPT-4 剧本 + Remotion 客户端渲染，实现“输入商品 URL 即出视频”的广告生成器。

## 可复用技术栈（按比赛 P0/P1 映射）

| 技术点 | AdGen 实现 | 比赛借鉴点 | 优先级 |
|---|---|---|---|
| 前端框架 | Next.js 15 + React 19 + TypeScript 5 | 比赛推荐 React + TS，直接对齐 | P0 |
| UI 组件库 | TailwindCSS + shadcn/ui | 原子化样式 + 可复用组件，快速搭建素材/剧本/创作三模块界面 | P0 |
| 状态管理 | Zustand + React Query | 全局状态（生成任务、素材库）+ 服务端状态同步（剧本轮询、任务进度）| P0 |
| URL 抓取 | Puppeteer (headless browser) | 一键成片场景：输入商品链接自动抓取标题、主图、卖点，减少商家手动录入 | P0 |
| 剧本生成 | OpenAI GPT-4 structured output | LLM 生成带货脚本/分镜，比赛可替换为 Seed-2.0-pro JSON mode | P0 |
| 视频合成 | Remotion (React-based 声明式视频) | 客户端合成轻量视频（字幕+图片+BGM），可作为预览/草稿兜底；正式视频走 Seedance | P1 |
| 表单校验 | Zod schema validation | LLM 输出 + 用户输入的统一校验层 | P0 |

## 核心流程可借鉴

```
商品 URL
  → Puppeteer 抓取（标题 / 图片 / 价格 / 卖点）
  → GPT-4 生成剧本（Hook + 卖点话术 + 分镜时间轴）
  → Remotion 组件渲染（按时间轴合成画面）
  → 导出 MP4
```

**比赛适配建议：**
- 将 `GPT-4` 替换为 `Seed-2.0-pro`（JSON mode 输出结构化剧本）。
- 将 `Remotion 终稿` 改为 `Seedance 1.5-pro` 异步生成，Remotion 仅用于**实时预览/草稿**。这样既有低延迟预览，又有高质量 AI 终稿。

## 关键代码模式

### 1. Zustand 全局状态（任务队列）
```typescript
interface TaskStore {
  tasks: GenerationTask[];
  addTask: (task: GenerationTask) => void;
  updateTask: (id: string, patch: Partial<GenerationTask>) => void;
}
export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTask: (id, patch) => set((s) => ({
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t))
  })),
}));
```
*适用于比赛“任务进度”模块：每个一键成片/批量生成都是一个 Task。*

### 2. React Query 轮询异步任务
```typescript
const { data } = useQuery({
  queryKey: ['videoTask', taskId],
  queryFn: () => fetchTask(taskId),
  refetchInterval: (data) =>
    data?.status === 'succeeded' || data?.status === 'failed' ? false : 5000,
});
```
*直接复用至 Seedance 异步任务轮询。*

### 3. Remotion 时间轴组件（分镜预览）
```typescript
// Remotion 将每个分镜作为一个 <Sequence>
<Sequence from={0} durationInFrames={150}>
  <ProductShot image={shot1.image} caption={shot1.text} />
</Sequence>
<Sequence from={150} durationInFrames={120}>
  <HighlightShot sellingPoint={shot2.highlight} />
</Sequence>
```
*比赛可借鉴：分镜级编辑器左侧列表 + 右侧 Remotion 预览，实现“局部刷新分镜”而不重渲整片。*

## 关键路径速查

| 相对路径 | 类/函数/组件 | 用途 |
|---|---|---|
| `src/app/page.tsx` | `Home` 组件 | 主页面：Stepper + 按 `step` 条件渲染（url → product → script → video） |
| `src/app/api/scrape/route.ts` | `POST`, `scrapeAmazon()`, `scrapeShopify()` | Puppeteer 抓取商品页：标题、价格、卖点、主图/变体图 |
| `src/app/api/generate-script/route.ts` | `POST`, OpenAI `chat.completions.create` | GPT-4 生成带货脚本，输出 VISUAL / VO 分镜格式 |
| `src/app/api/generate-video/route.ts` | `POST` | Remotion 视频渲染服务端入口 |
| `src/app/api/save-video/route.ts` | `POST` | 视频导出/保存处理 |
| `src/lib/store` | `useStore` (Zustand) | 全局状态：`step`, `isLoading`, `error` |
| `src/components/Stepper.tsx` | `Stepper` | 步骤条 UI |
| `src/components/UrlInputForm.tsx` | `UrlInputForm` | URL 输入表单 |
| `src/components/ProductPreview.tsx` | `ProductPreview` | 商品信息预览卡片 |
| `src/components/ScriptPreview.tsx` | `ScriptPreview` | 剧本预览与编辑 |
| `src/components/VideoPlayer.tsx` | `VideoPlayer` | 最终视频播放 |
| `src/types/product.ts` | `Product` interface | 商品数据类型：title, price, description, features, images |

## 踩坑与避坑

| 坑点 | 原因 | 比赛规避 |
|---|---|---|
| Puppeteer 在 Serverless 环境难部署 | 体积大/依赖 chromium | 比赛初期可用轻量 `fetch + cheerio` 替代，或仅支持“手动上传素材” |
| Remotion 客户端渲染大视频卡顿 | 浏览器内存限制 | Remotion 只做 5s 草稿预览，正式视频走服务端 Seedance |
| GPT-4 国内访问不稳 | 网络/合规 | 直接替换为火山 Seed-2.0-pro，OpenAI 兼容接口 |

## 一句话总结
AdGen 最值钱的是**“URL 自动抓取 + 声明式视频预览”**的组合。前者让一键成片真正一键，后者让分镜编辑可实时可视化。
