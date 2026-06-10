import subprocess
import os
import shutil
from pathlib import Path
from app.core.storage import STORAGE_ROOT


def concat_videos(video_paths: list[str], output_path: str, encode_audio: bool = False) -> str:
    """Concatenate multiple videos using ffmpeg concat demuxer.

    Args:
        encode_audio: When True, re-encode audio to AAC 44100 Hz so that
            mixed silent/TTS video streams are compatible.  Use this when
            some input videos may have audio and others may not.
    """
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

    # Re-encode audio when mixing TTS (has audio) with silent segments;
    # -c:a aac ensures all output streams are compatible.
    codec_args = (
        ["-c:v", "copy", "-c:a", "aac", "-ar", "44100"]
        if encode_audio
        else ["-c", "copy"]
    )

    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", list_file,
                *codec_args,
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
    """Speed/trim the composed video so all shots fit the selected final duration.

    Preserves the audio stream (TTS/BGM) when present, using atempo to keep
    audio in sync with the re-timed video.
    """
    if target_duration <= 0:
        raise ValueError("target_duration must be positive")

    path = Path(input_path)
    if not path.is_absolute():
        path = STORAGE_ROOT / input_path

    current_duration = get_video_duration(str(path))
    if current_duration <= 0:
        raise ValueError(f"Invalid video duration: {current_duration}")

    ratio = target_duration / current_duration

    # Detect whether the input carries an audio stream.
    probe = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-select_streams", "a:0",
            "-show_entries", "stream=index",
            "-of", "csv=p=0",
            str(path),
        ],
        capture_output=True,
        text=True,
    )
    has_audio = bool(probe.stdout.strip())

    if has_audio:
        # Build an atempo chain – filter accepts only [0.5, 2.0]; chain for
        # values outside that range.
        audio_tempo = 1.0 / ratio

        def _chain_atempo(tempo: float) -> str:
            steps: list[str] = []
            if tempo > 2.0:
                while tempo > 2.0:
                    steps.append("atempo=2.0")
                    tempo /= 2.0
            elif tempo < 0.5:
                while tempo < 0.5:
                    steps.append("atempo=0.5")
                    tempo /= 0.5
            steps.append(f"atempo={tempo:.6f}")
            return ",".join(steps)

        atempo = _chain_atempo(audio_tempo)
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", str(path),
                "-filter_complex",
                f"[0:v]setpts={ratio:.6f}*PTS[v];[0:a]{atempo}[a]",
                "-map", "[v]",
                "-map", "[a]",
                "-t", str(target_duration),
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-ar", "44100",
                output_path,
            ],
            check=True,
            capture_output=True,
        )
    else:
        subprocess.run(
            [
                "ffmpeg", "-y",
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

    # Mix TTS onto video: pad TTS audio with silence so it's never shorter
    # than the video, then let -shortest truncate to video length.
    try:
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", str(vp),
                "-i", str(tp),
                "-filter_complex", "[1:a]apad[tts_padded]",
                "-map", "0:v:0",
                "-map", "[tts_padded]",
                "-c:v", "copy",
                "-c:a", "aac",
                "-ar", "44100",
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


def ensure_audio_track(input_path: str, output_path: str) -> str:
    """Ensure the video has an AAC audio track.

    If the input already has an audio stream it is copied as-is.
    Otherwise a silent stereo 44100 Hz AAC track is added so that
    downstream concat/mix operations receive consistent stream layouts.
    """
    path = Path(input_path)
    if not path.is_absolute():
        path = STORAGE_ROOT / input_path

    probe = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-select_streams", "a:0",
            "-show_entries", "stream=index",
            "-of", "csv=p=0",
            str(path),
        ],
        capture_output=True,
        text=True,
    )
    if probe.stdout.strip():
        # Already has audio — copy unchanged
        shutil.copy2(str(path), output_path)
        return output_path

    # Add a silent stereo track
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(path),
            "-f", "lavfi",
            "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            "-ar", "44100",
            "-shortest",
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
