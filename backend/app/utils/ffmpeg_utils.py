import subprocess
import os
import shutil
from pathlib import Path
from app.core.storage import STORAGE_ROOT


def concat_videos(video_paths: list[str], output_path: str) -> str:
    """Concatenate multiple videos using ffmpeg concat demuxer."""
    if not video_paths:
        raise ValueError("No video paths provided")

    if len(video_paths) == 1:
        path = Path(video_paths[0])
        if not path.is_absolute():
            path = STORAGE_ROOT / video_paths[0]
        # Just copy
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(path), "-c", "copy", output_path],
            check=True,
            capture_output=True,
        )
        return output_path

    # Create concat list file
    list_file = output_path + ".concat_list.txt"
    with open(list_file, "w", encoding="utf-8") as f:
        for p in video_paths:
            # Normalize path for ffmpeg relative to STORAGE_ROOT
            path = Path(p)
            if not path.is_absolute():
                path = STORAGE_ROOT / p
            abs_path = path.resolve().as_posix()
            f.write(f"file '{abs_path}'\n")

    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", list_file,
                "-c", "copy",
                output_path,
            ],
            check=True,
            capture_output=True,
        )
    finally:
        if os.path.exists(list_file):
            os.remove(list_file)

    return output_path


def get_video_duration(video_path: str) -> float:
    path = Path(video_path)
    if not path.is_absolute():
        path = STORAGE_ROOT / video_path
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(result.stdout.strip())


def fit_video_duration(input_path: str, output_path: str, target_duration: int) -> str:
    """Speed/trim the composed video so all shots fit the selected final duration."""
    if target_duration <= 0:
        raise ValueError("target_duration must be positive")

    path = Path(input_path)
    if not path.is_absolute():
        path = STORAGE_ROOT / input_path

    current_duration = get_video_duration(str(path))
    if current_duration <= 0:
        raise ValueError(f"Invalid video duration: {current_duration}")

    # setpts ratio < 1 speeds up the whole montage while preserving every shot.
    ratio = target_duration / current_duration
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i", str(path),
            "-filter:v", f"setpts={ratio:.6f}*PTS",
            "-an",
            "-t", str(target_duration),
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-pix_fmt", "yuv420p",
            output_path,
        ],
        check=True,
        capture_output=True,
    )
    return output_path


def add_bgm(input_video_path: str, bgm_path: str, output_path: str, bgm_volume: float = 0.25) -> str:
    """Mix looped BGM into video, preserving original voice track if present."""
    video_path = Path(input_video_path)
    if not video_path.is_absolute():
        video_path = STORAGE_ROOT / input_video_path

    audio_path = Path(bgm_path)
    if not audio_path.is_absolute():
        audio_path = STORAGE_ROOT / bgm_path

    cmd_mix = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-stream_loop",
        "-1",
        "-i",
        str(audio_path),
        "-filter_complex",
        f"[1:a]volume={bgm_volume}[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[mix]",
        "-map",
        "0:v:0",
        "-map",
        "[mix]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        output_path,
    ]
    try:
        subprocess.run(cmd_mix, check=True, capture_output=True)
    except subprocess.CalledProcessError:
        # fallback: source video may not contain audio track
        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(video_path),
                    "-stream_loop",
                    "-1",
                    "-i",
                    str(audio_path),
                    "-filter:a",
                    f"volume={bgm_volume}",
                    "-map",
                    "0:v:0",
                    "-map",
                    "1:a:0",
                    "-c:v",
                    "copy",
                    "-c:a",
                    "aac",
                    "-shortest",
                    output_path,
                ],
                check=True,
                capture_output=True,
            )
        except subprocess.CalledProcessError:
            # Keep generation successful even if BGM file itself is invalid.
            shutil.copy2(video_path, output_path)
    return output_path


def add_tts_to_video(video_path: str, tts_path: str, output_path: str) -> str:
    """Mix TTS narration audio onto a (silent) video segment.

    The TTS audio will be truncated or padded with silence to match the
    video duration.  The original video stream is copied without re-encoding.
    """
    vp = Path(video_path)
    if not vp.is_absolute():
        vp = STORAGE_ROOT / video_path
    tp = Path(tts_path)
    if not tp.is_absolute():
        tp = STORAGE_ROOT / tts_path

    # Try mixing – if the video already has an audio track we replace it;
    # if it's silent we just add the TTS track.
    try:
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", str(vp),
                "-i", str(tp),
                "-filter_complex",
                (
                    "[1:a]apad=whole_dur=999[tts];"
                    "[tts]atrim=end_pts=DURATION[tts_trim]"
                ),
                "-map", "0:v:0",
                "-map", "[tts_trim]",
                "-c:v", "copy",
                "-c:a", "aac",
                "-shortest",
                output_path,
            ],
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError:
        # Simpler fallback: just mux video + TTS, rely on -shortest
        try:
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-i", str(vp),
                    "-i", str(tp),
                    "-map", "0:v:0",
                    "-map", "1:a:0",
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-shortest",
                    output_path,
                ],
                check=True,
                capture_output=True,
            )
        except subprocess.CalledProcessError:
            # If all else fails, return original video without TTS
            shutil.copy2(str(vp), output_path)
    return output_path


def scale_video(input_path: str, output_path: str, width: int, height: int):
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i", input_path,
            "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
            "-c:a", "copy",
            output_path,
        ],
        check=True,
        capture_output=True,
    )
    return output_path


def extract_last_frame(input_path: str, output_path: str) -> str:
    """Extract the final visual frame for chained Seedance continuation."""
    path = Path(input_path)
    if not path.is_absolute():
        path = STORAGE_ROOT / input_path
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-sseof", "-0.1",
            "-i", str(path),
            "-frames:v", "1",
            "-q:v", "2",
            output_path,
        ],
        check=True,
        capture_output=True,
    )
    return output_path
