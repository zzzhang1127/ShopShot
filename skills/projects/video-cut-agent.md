---
name: video-cut-agent
id: 7b8c9d0e-1f2a-8b9c-0d1e-2f3a4b5c6d7e
description: video-cut-agent 项目可复用技术/思路速查。面向电商 AIGC 视频生成比赛，提炼其“LangChain Agent 编排、媒体分析工具链、MoviePy 视频合成、音频混音”中可借鉴的自动化剪辑方案。
---

# video-cut-agent 项目可复用速查

## 一句话定位
基于 Gradio + LangChain 的智能视频生产 Agent。集成媒体分析（EXIF / ffprobe / librosa）、子 Agent 批量分析、MoviePy 结构化渲染、音频多轨混音、Doubao Seedream/Seedance 媒体生成。

## 可复用技术栈（按比赛 P0/P1 映射）

| 技术点 | video-cut-agent 实现 | 比赛借鉴点 | 优先级 |
|---|---|---|---|
| Agent 编排 | LangChain + 工具调用（Tools） | 比赛 P2 加分项：用 Agent 编排“剧本生成 → 素材召回 → 视频生成 → 后处理”全链路 | P2 |
| 媒体分析工具 | 图片 EXIF / 视频 ffprobe / 音频 librosa beat detection | 素材库模块：自动提取媒体元数据（分辨率/时长/码率/BPM），用于智能匹配 | P1 |
| 批量分析子 Agent | 子 Agent 并发分析多个素材文件 | 素材库入库时批量分析并打标签 | P1 |
| 视频合成 | MoviePy 结构化 JSON → 渲染引擎 | 智能剪辑模块：分镜脚本 JSON 直接驱动 MoviePy 合成 | P0 |
| 音频混音 | 多轨音频 + fade in/out + 自动 ducking | 成片后期：BGM + 配音 + 音效多轨混合 | P1 |
| 快速原型 | Gradio 界面 | 比赛后端逻辑验证期可用 Gradio 快速搭 Demo，但最终前端用 React | P2 |
| 多模态生成 | Doubao Seedream (图) + Seedance (视频) | 若需文生图再图生视频，可复用 Seedream 链路 | P1 |

## 核心流程可借鉴

```
用户输入（主题/素材/风格要求）
  → LangChain Agent 规划任务
    ├── 工具1：媒体分析（读取素材元数据）
    ├── 工具2：素材标签生成（LLM 理解内容）
    ├── 工具3：剧本生成（结合主题+素材标签）
    ├── 工具4：视频生成/召回（Seedance / 本地素材）
    └── 工具5：后处理合成（MoviePy 拼接+字幕+音频）
  → 输出成片
```

**比赛适配建议：**
- Agent 编排是 P2 亮点，P0/P1 阶段可用硬编码流程替代，P2 再引入 LangChain 增加灵活性。
- 媒体分析工具链是素材库“多颗粒度结构化”的基础设施，入库时自动跑一遍。
- MoviePy 合成引擎是“智能剪辑”的后处理核心，承接 Seedance 生成的分镜素材。

## 关键代码模式

### 1. LangChain 工具定义（媒体分析）
```python
from langchain.tools import BaseTool

class VideoProbeTool(BaseTool):
    name: str = "video_probe"
    description: str = "分析视频文件的时长、分辨率、码率、帧率等元数据"

    def _run(self, video_path: str) -> dict:
        import subprocess
        cmd = [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height,duration,bit_rate,r_frame_rate",
            "-of", "json", video_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return json.loads(result.stdout)
```
*素材入库时批量调用，自动填充素材元数据表。*

### 2. MoviePy 结构化渲染引擎
```python
from moviepy.editor import *
import json

def render_from_script(script_json: dict, output_path: str):
    clips = []
    for shot in script_json["shots"]:
        # 视频/图片片段
        if shot["type"] == "video":
            clip = VideoFileClip(shot["path"]).subclip(shot["start"], shot["end"])
        else:
            clip = ImageClip(shot["path"]).set_duration(shot["duration"])

        # 尺寸/位置调整
        clip = clip.resize(height=shot.get("height", 1920))
        if "position" in shot:
            clip = clip.set_position(shot["position"])

        clips.append(clip)

    # 合成视频
    video = concatenate_videoclips(clips, method="compose")

    # 叠加字幕
    if "subtitles" in script_json:
        txt_clips = []
        for sub in script_json["subtitles"]:
            txt = TextClip(sub["text"], fontsize=64, color='white', stroke_color='black', stroke_width=2)
            txt = txt.set_position(('center', 'bottom')).set_start(sub["start"]).set_duration(sub["duration"])
            txt_clips.append(txt)
        video = CompositeVideoClip([video, *txt_clips])

    # 音频混合
    if "audio_tracks" in script_json:
        audios = []
        for track in script_json["audio_tracks"]:
            audio = AudioFileClip(track["path"])
            if track.get("fade_in"):
                audio = audio.audio_fadein(track["fade_in"])
            if track.get("fade_out"):
                audio = audio.audio_fadeout(track["fade_out"])
            if track.get("volume"):
                audio = audio.volumex(track["volume"])
            audios.append(audio)
        video = video.set_audio(CompositeAudioClip(audios))

    video.write_videofile(output_path, fps=24, codec='libx264')
```
*比赛“智能剪辑”核心：分镜脚本 JSON → MoviePy 渲染。*

### 3. 音频 Beat Detection（自动踩点剪辑）
```python
import librosa

def detect_beats(audio_path: str) -> list[float]:
    y, sr = librosa.load(audio_path)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    return beat_times.tolist()
```
*P1 进阶：BGM 自动踩点，分镜切换对齐音乐节拍。*

## 关键路径速查

| 相对路径 | 类/函数 | 用途 |
|---|---|---|
| `agent.py` | `video_cut_result` (Pydantic BaseModel), `create_agent()` | 主 Agent 定义：工具 = video_synthesis + media_analysis + seedance + seedream |
| `tools/video_synthesis.py` | `VideoSynthesisData`, `VideoSynthesisSettings`, `TrackInfo`, `ShotInfo`, `ClipInfo`, `TextInfo`, `AudioClipInfo`, `TransitionInfo` | MoviePy 三层数据结构：轨道 → 镜头 → 素材/文字/音频 |
| `tools/video_synthesis.py` | `render_video()`, `video_synthesis_tool()` | 主渲染函数：JSON → MoviePy → MP4；LangChain Tool 包装器 |
| `tools/video_synthesis.py` | `_render_track()`, `_render_shot()`, `_apply_transition()`, `_create_clip_from_info()`, `_create_text_clip()`, `_create_audio_clip()` | 底层渲染：轨道合成、镜头合成、转场、素材加载、文字、音频 |
| `tools/video_synthesis.py` | `_dict_to_video_data()` | JSON dict → VideoSynthesisData 递归解析器 |
| `sub_agents/media_analysis_agent.py` | `create_media_analysis_agent()`, `media_analysis_sub_agent_tool()` | 素材分析子 Agent：图片/视频/音频元数据与内容理解 |
| `tools/media_analysis/image_analysis.py` | `image_basic_analysis_tool`, `image_understand_tool` | 图片分析：EXIF + 内容描述 |
| `tools/media_analysis/video_analysis.py` | `video_basic_analysis_tool`, `video_understand_tool` | 视频分析：ffprobe + 首末帧内容理解 |
| `tools/media_analysis/audio_analysis.py` | `audio_basic_analysis_tool`, `audio_beat_analysis_tool` | 音频分析：码率/采样率 + Beat Detection（librosa） |
| `tools/media_generate/ark_base.py` | `seedance_lite_fflf2v()`, `seedream_4_0_i2i()` | 火山方舟媒体生成：Seedance Lite 图生视频、Seedream 图生图 |
| `gradio_app.py` | Gradio UI | 快速原型界面 |
| `resources/fonts/` | `NotoSansSC-Bold.ttf`, `NotoSansSC-Regular.ttf`, `YouSheBiaoTiHei.ttf` | 中文字体资源（字幕渲染用） |

## 踩坑与避坑

| 坑点 | 原因 | 比赛规避 |
|---|---|---|
| Gradio 难以实现复杂分镜编辑器 | 组件能力有限 | 前端用 React 实现分镜时间轴，Gradio 仅做后端调试 |
| MoviePy 大视频内存占用高 | 全部加载到内存 | 分镜生成时控制单段时长（≤5s），合并用 FFmpeg 而非 MoviePy concat |
| LangChain 调试困难 | Agent 决策链黑盒 | P0/P1 用硬编码流程，P2 再引入 Agent；若用 Agent，必须暴露完整 trace |
| ffprobe/librosa 依赖系统环境 | 需要安装 FFmpeg / Python 科学计算库 | Docker 镜像预装依赖，或比赛 Demo 期用轻量替代方案 |
| Seedream 图生图不可控 | 与 Seedance 风格不统一 | 若需图生图，先用 Seedance 直接图生视频，减少中间环节 |

## 一句话总结
video-cut-agent 最值钱的是**“LangChain Agent 编排 + MoviePy 结构化渲染 + 音频多轨混音”**。它是比赛“智能剪辑 Agent”和“后处理合成引擎”的直接参考，尤其适合需要复杂自动化工作流的 P2 亮点探索。
