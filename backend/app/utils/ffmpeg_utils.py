import subprocess
import os
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
