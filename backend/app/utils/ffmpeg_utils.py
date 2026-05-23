import subprocess
import os
from pathlib import Path


def concat_videos(video_paths: list[str], output_path: str) -> str:
    """Concatenate multiple videos using ffmpeg concat demuxer."""
    if not video_paths:
        raise ValueError("No video paths provided")

    if len(video_paths) == 1:
        # Just copy
        subprocess.run(
            ["ffmpeg", "-y", "-i", video_paths[0], "-c", "copy", output_path],
            check=True,
            capture_output=True,
        )
        return output_path

    # Create concat list file
    list_file = output_path + ".concat_list.txt"
    with open(list_file, "w", encoding="utf-8") as f:
        for p in video_paths:
            # Normalize path for ffmpeg
            abs_path = Path(p).resolve().as_posix()
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
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path,
        ],
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


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
