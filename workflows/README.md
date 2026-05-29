# ComfyUI 工作流目录

将 ComfyUI 导出的 **API Format** JSON 放在此目录，ShopShot 项目页即可**一键选择 + 填提示词**运行，无需手贴 JSON。

## 快速开始

1. 本地启动 [ComfyUI](https://github.com/comfyanonymous/ComfyUI)（默认 `http://127.0.0.1:8188`）
2. 在 ShopShot 根目录 `.env` 中设置：

```env
COMFYUI_ENABLED=true
COMFYUI_URL=http://127.0.0.1:8188
```

3. 把导出的工作流 JSON 放到本目录，建议命名（与 Pixelle-Video 一致）：

| 前缀 | 用途 |
|------|------|
| `image_*.json` | 生图 |
| `video_*.json` | 生视频 |
| `tts_*.json` | 语音 / TTS |

4. 重启后端，在项目页 **ComfyUI（可选）** 面板选择预置 → 输入提示词 → **一键运行**

## 可视化编辑（拖拽画布）

ShopShot **不内置**节点画布；请在 ComfyUI 网页中拖拽编排，完成后：

**Save (API Format)** → 保存到本目录 → 在 ShopShot 选预置即可。

项目页提供 **「打开 ComfyUI 画布」** 链接，直达可视化编辑器。

## 提示词绑定（推荐）

在 ComfyUI 中把需要程序填入的文本节点 **Title** 改为：

- `$prompt.text!` — 绑定到 ShopShot「提示词」输入框（CLIP Text Encode 等）
- `$prompt.value!` — 绑定到数值/文本 value 输入

也可在 JSON 里把占位符写成 `{{prompt}}`，运行时会自动替换。

## 从 Pixelle-Video 复制

若已克隆 `projects/Pixelle-Video`，可将其 `workflows/selfhost/` 或 `workflows/runninghub/` 下的 JSON 复制到本目录。
