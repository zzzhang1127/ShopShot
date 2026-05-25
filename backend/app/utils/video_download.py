"""从 Seedance 等远程 URL 下载视频并校验，拒绝 mock 占位文件。"""

import requests

# FFmpeg 红屏占位约 12KB；真实 Seedance 成片通常 > 100KB
MIN_VIDEO_BYTES = 80_000
MOCK_PLACEHOLDER_SIZE = 12_763


def download_video_from_url(url: str, timeout: int = 300) -> bytes:
    if not url or not str(url).startswith(("http://", "https://")):
        raise ValueError(f"无效的视频 URL（必须为远程地址）: {url!r}")

    resp = requests.get(url, timeout=timeout, stream=True)
    resp.raise_for_status()
    data = resp.content
    validate_video_bytes(data, source=url)
    return data


def validate_video_bytes(data: bytes, source: str = "") -> None:
    size = len(data)
    if size <= MOCK_PLACEHOLDER_SIZE + 500:
        raise ValueError(
            f"下载的视频过小（{size} 字节），疑似 Mock 红屏占位而非真实 API 成片。"
            f" 请确认 MOCK_MODE=false 并已重启后端。 source={source[:120]}"
        )
    if size < MIN_VIDEO_BYTES:
        raise ValueError(
            f"视频文件过小（{size} 字节 < {MIN_VIDEO_BYTES}），可能下载失败或 API 异常。 source={source[:120]}"
        )
    if len(data) >= 12 and data[4:8] != b"ftyp" and not data.startswith(b"\x00\x00\x00"):
        # 常见 MP4 以 ftyp 开头；非严格但可挡 JSON 错误页
        if data[:1] == b"{" or b"error" in data[:200].lower():
            raise ValueError(f"下载内容不是有效 MP4（疑似错误响应）。 source={source[:120]}")
