"""TTS (Text-to-Speech) client using edge-tts (Microsoft Azure neural voices)."""
import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Available Chinese neural voices
VOICES = {
    "xiaoxiao": "zh-CN-XiaoxiaoNeural",   # 小晓 - 暖心女声（推荐，电商常用）
    "yunxi": "zh-CN-YunxiNeural",          # 云希 - 阳光男声
    "xiaoyi": "zh-CN-XiaoyiNeural",        # 晓伊 - 活泼女声
    "yunjian": "zh-CN-YunjianNeural",       # 云健 - 磁性男声
    "xiaomo": "zh-CN-XiaomoNeural",        # 晓墨 - 温柔女声
}
DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"

VOICE_LABELS = {
    "zh-CN-XiaoxiaoNeural": "小晓（暖心女声）",
    "zh-CN-YunxiNeural": "云希（阳光男声）",
    "zh-CN-XiaoyiNeural": "晓伊（活泼女声）",
    "zh-CN-YunjianNeural": "云健（磁性男声）",
    "zh-CN-XiaomoNeural": "晓墨（温柔女声）",
}


def _check_available() -> bool:
    try:
        import edge_tts  # noqa: F401
        return True
    except ImportError:
        return False


async def _generate_async(text: str, output_path: str, voice: str, rate: str = "+0%") -> str:
    import edge_tts
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(output_path)
    return output_path


def generate_tts(
    text: str,
    output_path: str,
    voice: str = DEFAULT_VOICE,
    rate: str = "+5%",
) -> str:
    """Generate TTS audio from text and save to output_path (.mp3).

    Args:
        text: The narration text.
        output_path: Destination file path (should end with .mp3).
        voice: Edge TTS voice name (default: zh-CN-XiaoxiaoNeural).
        rate: Speech rate modifier, e.g. "+10%" for faster, "-5%" for slower.

    Returns:
        output_path on success.

    Raises:
        RuntimeError if edge-tts is not installed.
        Exception propagated from edge-tts on network/API failure.
    """
    if not _check_available():
        raise RuntimeError(
            "edge-tts is not installed. Run: pip install edge-tts"
        )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    try:
        asyncio.run(_generate_async(text, output_path, voice, rate))
    except RuntimeError as e:
        # Nested asyncio.run() when already inside an event loop
        if "cannot be called from a running event loop" in str(e):
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                fut = pool.submit(
                    asyncio.run,
                    _generate_async(text, output_path, voice, rate),
                )
                fut.result(timeout=60)
        else:
            raise

    logger.info("TTS generated: %s (%d chars)", output_path, len(text))
    return output_path


def is_available() -> bool:
    return _check_available()
