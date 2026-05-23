---
name: ad-video-gen
id: 8c9d0e1f-2a3b-9c0d-1e2f-3a4b5c6d7e8f
description: 火山方舟官方电商营销视频生成 Multi-Agent 系统（ai-app-lab/demohouse/ad_video_gen）。核心为 VeADK 多 Agent 协作框架，含导演 Agent（分镜/生图/生视频）、评估 Agent（抽卡择优）、营销/发布 Agent。最终效果必须依靠 Agent 编排实现。
---

# 电商营销视频 Multi-Agent 系统可复用速查

## 一句话定位
火山方舟官方 Demo：基于 VeADK 的 A2A Multi-Agent 电商营销视频生成系统。由营销策划、视频导演、评估、合成发布 4 大 Agent 组成，端到端完成"需求理解 → AIDA 分镜设计 → 图生图 → 图生视频 → 质量评估抽卡 → 合成发布"。

## 可复用技术栈（按比赛 P0/P1/P2 映射）

| 技术点 | ad_video_gen 实现 | 比赛借鉴点 | 优先级 |
|---|---|---|---|
| Multi-Agent 框架 | VeADK (Volcengine Agent Development Kit) + A2A 通信 | **最终效果必须依靠 Agent**。导演/评估/营销/发布多 Agent 分工协作 | P0 |
| 导演 Agent 编排 | `director-agent` 含 3 个子 Agent（story → image → video），由根 Agent 调度 | 比赛核心创作链路：剧本 → 素材 → 视频，全部 Agent 化 | P0 |
| SequentialAgent 模式 | 每个子 Agent = 生成 Agent + 格式化 Agent 串联 | 保证输出格式严格符合 JSON Schema，降低解析失败率 | P0 |
| AIDA 营销分镜模型 | Attention → Interest → Desire → Action 四镜结构 | 比赛剧本模块：结构化带货剧本可直接套用 AIDA | P0 |
| 抽卡评估机制 | `evaluate-agent` 对图片/视频批量生成结果打分，择优录取 | 比赛 P1：同一分镜生成多版，自动选最优，提升成片率 | P1 |
| 模型文本命令 | `--rs 720p --rt 9:16 --fps 24 --wm false --seed 7 --cf false` | Seedance prompt 后附加参数控制分辨率/比例/水印/种子 | P0 |
| 首帧图生视频 | 分镜图片作为 `first_frame`，action 作为 prompt | 比赛创作模块：图生视频的标准工作流 | P0 |
| Hook 机制 | `after_tool_callback`（错误检查、短链接还原）、`after_model_callback`（格式修复） | Agent 执行链路中的容错与后处理 | P1 |
| 短链接服务 | `short_link/` 独立服务，解决 TOS URL 过长导致模型截断 | 若 Seedance 返回 URL 过长，可用短链接中转 | P2 |
| 营销分析 Agent | `market-agent` 解析商品链接，Playwright 抓取页面，提炼卖点 | 比赛一键成片：输入商品 URL 自动提取信息 | P1 |
| 发布 Agent | `release-agent` 视频合成与多平台发布 | 比赛数据回流上游：模拟发布获取链接 | P2 |

## 核心 Multi-Agent 架构

```
用户输入（商品链接/需求）
  → market-agent（营销策划）
    ├── 解析商品页面（Playwright）
    └── 输出 video_config（产品信息+卖点+素材+视频类型建议）
  → director-agent（视频导演）根 Agent 调度
    ├── story_sequential_agent（分镜脚本）
    │   ├── storyboard_agent：按 AIDA 生成 4 分镜（image/action/words/reference）
    │   └── story_format_agent：严格格式化为 JSON（ShotList Schema）
    ├── image_sequential_agent（分镜图片）
    │   ├── image_agent：按 prompt + reference 批量生成图片（Seedream）
    │   └── image_format_agent：格式化为 JSON（ImageList Schema）
    └── video_agent（分镜视频）
        ├── video_generate_agent：按 action + first_frame 批量生成视频（Seedance）
        └── video_format_agent：格式化为 JSON（VideoList Schema）
  → evaluate-agent（质量评估）
    ├── evaluate_media（GEval 打分）
    └── 输出 scored_list，供 pick_best 选择最高分素材
  → release-agent（合成发布）
    ├── 素材合成为最终视频
    └── 发布到平台
```

**比赛适配建议：**
- **必须复用此 Agent 架构**。导演 Agent 的"根 Agent 调度子 Agent"模式是比赛创作模块的核心。
- AIDA 四镜结构天然适合 15s 电商视频（3~4镜 × 3~5s）。
- 评估 Agent 的抽卡机制解决 AI 生成不确定性，是提升成片质量的关键。
- VeADK 若太重，可用 LangChain/LangGraph 复刻相同架构。

## 关键路径速查

| 相对路径（基于 `ai-app-lab/demohouse/ad_video_gen/backend/app/`） | 类/函数/模块 | 用途 |
|---|---|---|
| `main.py` | `main()`, `run_sse()`, `pick_best_image()`, `pick_best_video()` | 测试主程序：7 步流水线（config → shot → image → eval image → video → eval video → final） |
| `director-agent/src/director_agent/agent.py` | `Agent(name="director_agent")`, `root_agent` | 导演根 Agent：调度 story/image/video 三个子 Agent |
| `director-agent/src/director_agent/prompt.py` | `PROMPT_ROOT_AGENT`, `PROMPT_STORYBOARD_AGENT`, `PROMPT_IMAGE_AGENT`, `PROMPT_VIDEO_AGENT` | 系统提示词：根 Agent 调度指令 + 各子 Agent 角色定义 |
| `director-agent/src/director_agent/sub_agents/storyboard/agent.py` | `storyboard_agent`, `story_format_agent`, `story_agent` (SequentialAgent) | 分镜子 Agent：生成 → 格式化串联 |
| `director-agent/src/director_agent/sub_agents/image/agent.py` | `image_agent`, `image_format_agent` | 图片子 Agent：Seedream 图生图 |
| `director-agent/src/director_agent/sub_agents/video/agent.py` | `video_generate_agent`, `video_format_agent`, `video_agent` (SequentialAgent) | 视频子 Agent：Seedance 图生视频 |
| `director-agent/src/director_agent/tools/video_generate_http.py` | `video_generate()`, `generate()`, `resolve_short_url()` | 视频生成工具：HTTP 调用 Seedance，支持批量提交 + 轮询 + 首尾帧 + 模型文本命令 |
| `director-agent/src/director_agent/hook/check_and_raise.py` | `raise_result_error` | Tool 后 Hook：检查结果错误并抛出 |
| `director-agent/src/director_agent/hook/format_hook.py` | `fix_output_format` | Model 后 Hook：修复 JSON 格式异常 |
| `director-agent/src/director_agent/hook/shorten_url.py` | `hook_shorten_url` | Tool 后 Hook：将长 URL 转为短链接 |
| `evaluate-agent/src/evaluate_agent/agent.py` | `EvaluateAgent` (继承 Agent), `evaluate_media` | 评估 Agent：GEval 打分，支持 skip_summarization 直接输出 |
| `evaluate-agent/src/evaluate_agent/tools/geval.py` | `evaluate_media()` | GEval 评估工具：对图片/视频质量多维度评分 |
| `market-agent/src/` | 营销策划 Agent | 商品页面解析 + 营销策略生成 |
| `release-agent/src/` | 发布 Agent | 视频合成 + 平台发布 |
| `short_link/app.py` | 短链接服务 | URL 压缩与还原 |

## 核心代码模式

### 1. VeADK SequentialAgent 串联模式（生成 + 格式化）
```python
from veadk import Agent
from veadk.agents.sequential_agent import SequentialAgent

# 生成 Agent：负责创意内容生成
storyboard_agent = Agent(
    name="storyboard_agent",
    instruction=PROMPT_STORYBOARD_AGENT,  # AIDA 分镜设计提示词
    generate_content_config=max_output_tokens_config,
)

# 格式化 Agent：负责严格 JSON 输出
story_format_agent = Agent(
    name="story_format_agent",
    instruction=PROMPT_STORY_FORMAT_AGENT,  # 格式转换提示词
    generate_content_config=json_response_config,
    output_schema=ShotList,     # Pydantic Schema 约束
    output_key="shot_list",     # 输出字段名
    after_model_callback=[fix_output_format],  # 格式修复 Hook
)

# 串联为顺序 Agent
story_agent = SequentialAgent(
    name="story_sequential_agent",
    sub_agents=[storyboard_agent, story_format_agent],
)
```
*比赛复用：每个创作阶段（剧本→图片→视频）都用"生成+格式化"串联，确保输出可被下游消费。*

### 2. 根 Agent 调度子 Agent
```python
from veadk import Agent

agent = Agent(
    name="director_agent",
    instruction=PROMPT_ROOT_AGENT,  # 定义何时调用哪个子 Agent
    sub_agents=[story_agent, image_agent, video_agent],
)
```
*PROMPT_ROOT_AGENT 核心指令：识别用户请求类型（shot/image/video），调用对应子 Agent，禁止自己直接返回。*

### 3. 批量视频生成 + 轮询（带模型文本命令）
```python
async def video_generate(params: list, tool_context: ToolContext, batch_size: int = 32):
    # params 每项：{video_name, prompt, first_frame, last_frame}
    # prompt 示例："推镜头展示西梅饮料瓶身。 --rs 720p --rt 9:16 --fps 24 --wm false --seed 7"
    for start_idx in range(0, len(params), batch_size):
        batch = params[start_idx:start_idx + batch_size]
        task_dict = {}
        for item in batch:
            response = await generate(item["prompt"], item["first_frame"], item["last_frame"])
            task_dict[response["id"]] = item["video_name"]

        # 轮询
        while task_dict:
            for task_id in list(task_dict.keys()):
                result = await query_task(task_id)
                if result["status"] == "succeeded":
                    success_list.append({task_dict[task_id]: result["content"]["video_url"]})
                    task_dict.pop(task_id)
                elif result["status"] == "failed":
                    error_list.append(task_dict[task_id])
                    task_dict.pop(task_id)
            await asyncio.sleep(10)
```
*比赛复用：Seedance 批量生成核心逻辑，支持 prompt 尾部的模型命令（--rs/--rt/--wm 等）。*

### 4. AIDA 分镜脚本 Prompt 模板
```
# 分镜1 - 注意（Attention）
画面：吸睛开头；通过运镜特效展示高颜值商品场景图，形成强视觉冲击
首帧图：采用图生图模型，严格参考用户上传的图片素材，并替换为创意背景

# 分镜2 - 兴趣（Interest）
画面：场景化演示；构思高频强相关场景或人群
首帧图：采用文生图模型，生成使用场景画面

# 分镜3 - 欲望（Desire）
画面：细节特写；特写展示产品原料、成分、口味等卖点
首帧图：文生图模型（构思创意特写画面）

# 分镜4 - 行动（Action）
画面：以产品包装运镜特效作为结尾，引导用户下单行动
首帧图：采用图生图模型，严格参考用户上传的图片素材
```
*直接复用至比赛剧本模块，4 镜 × 3~4s = 12~16s，完美契合 15s 限制。*

### 5. 评估抽卡择优
```python
def pick_best_image(evaluate_image_result):
    best_image_list = []
    scored_image_list = evaluate_image_result["scored_image_list"]
    for shot in scored_image_list:
        # 从 images 列表中挑选最高分
        best_image = max(shot["images"], key=lambda x: max(float(x.get("score")), 0))
        best_image_list.append({
            "shot_id": shot["shot_id"],
            "image": {"id": best_image["id"], "url": best_image["url"]}
        })
    return best_image_list
```
*比赛 P1：同一分镜生成 N 版（如 4 版），评估 Agent 打分后选最优，显著提升成片质量。*

## 踩坑与避坑

| 坑点 | 原因 | 比赛规避 |
|---|---|---|
| VeADK 依赖较重 | 需要火山方舟 AK/SK + API Key + Playwright | 可用 LangChain/LangGraph 复刻相同架构，降低部署门槛 |
| 模型文本命令格式不统一 | `--rs` 等命令仅部分模型支持 | 明确使用 Seedance 1.5-pro，不支持命令时改用 API 参数 |
| 首帧图与视频比例不匹配 | Seedance 自动裁剪 | 上传前按目标 ratio 预处理图片，避免商品主体被裁 |
| 长 URL 被模型截断 | 模型上下文限制 | 使用短链接服务（如本项目 `short_link/`）中转 TOS URL |
| AIDA 模板同质化 | 大量商品套用同一结构 | 引入 LLM 对每镜做"卖点因子级微创新"，如替换场景/人群/运镜 |
| 评估标准主观 | GEval 打分可能不稳定 | 结合规则化硬指标（分辨率、时长、有无黑边）与 LLM 软评分 |

## 一句话总结
ad_video_gen 最值钱的是**"VeADK Multi-Agent 协作架构 + AIDA 营销分镜设计 + 评估抽卡择优机制"**。这是比赛要求"最终效果必须依靠 Agent"的官方参考答案，导演 Agent 的"根调度 → 子 Agent 串联 → 工具调用 → Hook 容错"模式应作为 ShopShot 创作模块的核心架构直接复用。
