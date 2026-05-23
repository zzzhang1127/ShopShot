---
name: moneyprinterplus
id: 2c6b9f5e-23e1-4f67-9f3c-3d3e4c5b6a7b
description: MoneyPrinterPlus 项目可复用技术/思路速查。面向电商 AIGC 视频生成比赛，提炼其“多提供商 TTS 集成、本地素材批量混剪、30+ 转场效果、自动发布”中可借鉴的剪辑与配音方案。
---

# MoneyPrinterPlus 项目可复用速查

## 一句话定位
Python + Streamlit 的 AI 短视频批量生成与混剪工具。核心能力：LLM 生成文案 → 多平台 TTS 配音 → 本地素材批量混剪（30+ 转场）→ 自动发布到抖音/快手/小红书/视频号。

## 可复用技术栈（按比赛 P0/P1 映射）

| 技术点 | MoneyPrinterPlus 实现 | 比赛借鉴点 | 优先级 |
|---|---|---|---|
| 多提供商 TTS | Azure / 阿里云 / 腾讯云 / ChatTTS 统一抽象接口 | 比赛剧本模块“配音（多语种）”可直接复用此抽象层，Seedance 自带 generate_audio 时也可 fallback 到外部 TTS | P1 |
| 批量混剪 | 本地视频/图片素材按脚本时间轴拼接 | 比赛“智能剪辑”模块：将 Seedance 生成的分镜视频与商家素材切片按剧本拼接 | P0 |
| 转场效果 | 30+ 转场（fade、slide、zoom、wipe 等） | 提升成片质感，分镜之间过渡自然 | P1 |
| 字幕生成 | 基于 TTS 文本自动对齐时间轴生成字幕 | 比赛“字幕”能力：文本 + 时间戳 → 字幕文件 / 硬字幕 | P1 |
| 自动发布 | Selenium 模拟登录 + 上传 + 填标题标签 | 比赛“数据回流”上游：模拟发布获取链接，再 mock 转化数据 | P2 |
| 批量生成 | 一次配置，批量产出多条视频 | 比赛“一键成片”的批量版本，用于 A/B 测试不同剧本/风格 | P1 |
| BGM 混合 | 背景音乐 + 配音音量自动 ducking | 避免 BGM 盖过人声，提升观看体验 | P1 |

## 核心流程可借鉴

```
主题/商品信息输入
  → LLM 生成多条文案（批量）
  → TTS 生成配音（每条文案一个音频）
  → 按脚本从本地素材库抽取视频/图片片段
  → 按时间轴拼接片段 + 插入转场 + 叠加字幕
  → 叠加 BGM（自动音量压制）
  → 导出成片
  → （可选）Selenium 自动发布到各平台
```

**比赛适配建议：**
- 将“本地素材库”替换为 ShopShot 的“素材库建设”模块（结构化切片 + 向量检索）。
- 将“LLM 文案”接入 Seed-2.0-pro，生成带货话术而非通用文案。
- 将“自动发布”降级为 mock，重点在前面的“混剪+字幕+配音”。

## 关键代码模式

### 1. TTS 提供商统一抽象
```python
from abc import ABC, abstractmethod

class TTSProvider(ABC):
    @abstractmethod
    def synthesize(self, text: str, voice: str, speed: float = 1.0) -> bytes:
        """返回音频 bytes (mp3/wav)"""
        pass

class AzureTTS(TTSProvider): ...
class AliyunTTS(TTSProvider): ...
class ChatTTS(TTSProvider): ...
```
*比赛可直接复用：当 Seedance `generate_audio: true` 不满足需求（如需特定音色/语速）时，切到外部 TTS。*

### 2. 视频混剪时间轴（MoviePy 风格）
```python
from moviepy.editor import *

clips = []
for seg in script_segments:
    clip = ImageClip(seg.image_path).set_duration(seg.duration)
    # 或 VideoFileClip(seg.video_path).subclip(start, end)
    clips.append(clip)

final = concatenate_videoclips(clips, method="compose", padding=-1, bg_color=(0,0,0))
final = final.set_audio(CompositeAudioClip([bgm, tts_audio]))
final.write_videofile("output.mp4", fps=24)
```
*比赛“智能剪辑”底层可用 MoviePy / FFmpeg 实现，承接 Seedance 生成的分镜视频。*

### 3. 转场效果枚举（部分）
```python
TRANSITIONS = [
    "fade", "slide_left", "slide_right", "slide_up", "slide_down",
    "zoom_in", "zoom_out", "wipe_left", "wipe_right", "crossfade",
    "pixelize", "blur", "flash", "spin", "squeeze"
]
```
*分镜编辑时让用户选择或随机分配转场。*

## 关键路径速查

| 相对路径 | 类/函数 | 用途 |
|---|---|---|
| `main.py` | `main_generate_video_content()`, `main_generate_video_dubbing()`, `main_get_video_resource()`, `main_generate_subtitle()`, `main_generate_ai_video()`, `main_generate_ai_video_for_mix()` | 主流程：文案生成 → 配音 → 素材获取 → 字幕 → 视频合成 |
| `config/config.py` | `my_config`, `audio_voices_azure`, `audio_voices_ali`, `audio_voices_tencent` | 全局配置与音色列表 |
| `services/llm/llm_provider.py` | `get_llm_provider()` | LLM 提供商工厂：Azure/Baichuan/Baidu/DeepSeek/Kimi/OpenAI/TongYi/Ollama |
| `services/audio/azure_service.py` | `AzureAudioService` | Azure TTS：`.save_with_ssml()` / `.read_with_ssml()` |
| `services/audio/alitts_service.py` | `AliAudioService` | 阿里云 TTS |
| `services/audio/tencent_tts_service.py` | `TencentAudioService` | 腾讯云 TTS |
| `services/audio/chattts_service.py` | `ChatTTSAudioService` | ChatTTS 本地配音：`.chat_with_content()` |
| `services/audio/gptsovits_service.py` | `GPTSoVITSAudioService` | GPT-SoVITS 本地配音 |
| `services/video/video_service.py` | `VideoService`, `VideoMixService`, `get_audio_duration()` | 视频服务：素材匹配、尺寸归一化、音画合成 |
| `services/video/merge_service.py` | `VideoMergeService`, `merge_get_video_list()`, `merge_generate_subtitle()` | 多场景合并与 BGM 合成 |
| `services/captioning/captioning_service.py` | `generate_caption()`, `add_subtitles()` | 字幕生成与硬字幕烧录 |
| `services/hunjian/hunjian_service.py` | `concat_audio_list()`, `get_audio_and_video_list()`, `get_audio_and_video_list_local()` | 混剪服务：音频拼接、本地素材批量配对 |
| `services/resource/pexels_service.py` | `PexelsService` | Pexels 素材抓取 |
| `services/resource/pixabay_service.py` | `PixabayService` | Pixabay 素材抓取 |
| `tools/utils.py` | `random_with_system_time()`, `extent_audio()` | 工具：文件名生成、音频尾部延长 2s |
| `const/video_const.py` | 视频常量 | 转场、分辨率等枚举 |
| `gui.py` | Streamlit GUI | 界面入口（可选参考） |

## 踩坑与避坑

| 坑点 | 原因 | 比赛规避 |
|---|---|---|
| Streamlit 不适合复杂交互 | 没有精细化分镜编辑器 | 比赛前端用 React，Streamlit 仅作内部工具原型 |
| Selenium 自动发布易被封 | 平台反爬策略 | 比赛只做 mock 发布，不真发 |
| ChatTTS 长文本不稳定 | 显存/断句问题 | 长文案先拆句再逐句合成，最后拼接 |
| 本地素材版权问题 | 混剪素材来源不明 | 比赛使用商家自有素材 + Seedance 原创生成 |

## 一句话总结
MoneyPrinterPlus 最值钱的是**“多提供商 TTS 抽象 + 本地素材批量混剪 + 转场/字幕/BGM 自动合成”**。它是比赛“智能剪辑”模块的工程化参考，尤其当 Seedance 只负责生成分镜素材、后处理需要拼接时。
