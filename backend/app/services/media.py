"""Обёртки над ffprobe/ffmpeg (доступны в образе backend).

На фазе D используется только ffprobe (метаданные при скане библиотеки).
Извлечение аудио и рендер — фазы E/G.
"""
from __future__ import annotations

import json
import logging
import subprocess

log = logging.getLogger(__name__)

VIDEO_EXTENSIONS = {".mkv", ".mp4", ".avi", ".mov", ".m4v", ".webm", ".ts", ".mpg", ".mpeg", ".wmv", ".flv"}


class ProbeError(RuntimeError):
    pass


def _parse_fps(rate: str | None) -> float | None:
    if not rate or rate == "0/0":
        return None
    try:
        if "/" in rate:
            num, den = rate.split("/")
            den_f = float(den)
            return round(float(num) / den_f, 3) if den_f else None
        return float(rate)
    except (ValueError, ZeroDivisionError):
        return None


def ffprobe(path: str) -> dict:
    """Метаданные видео: duration, width, height, fps, codec, container."""
    cmd = [
        "ffprobe", "-v", "error",
        "-print_format", "json",
        "-show_format", "-show_streams",
        path,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except FileNotFoundError as exc:
        raise ProbeError("ffprobe не найден в образе.") from exc
    except subprocess.TimeoutExpired as exc:
        raise ProbeError(f"ffprobe не успел за таймаут: {path}") from exc

    if proc.returncode != 0:
        raise ProbeError(f"ffprobe ошибка для {path}: {proc.stderr.strip()[:300]}")

    data = json.loads(proc.stdout or "{}")
    fmt = data.get("format", {})
    duration = None
    try:
        duration = float(fmt.get("duration")) if fmt.get("duration") else None
    except (TypeError, ValueError):
        duration = None

    video_stream = next(
        (s for s in data.get("streams", []) if s.get("codec_type") == "video"), None
    )
    width = height = fps = codec = None
    if video_stream:
        width = video_stream.get("width")
        height = video_stream.get("height")
        fps = _parse_fps(video_stream.get("avg_frame_rate") or video_stream.get("r_frame_rate"))
        codec = video_stream.get("codec_name")

    return {
        "duration": duration,
        "width": width,
        "height": height,
        "fps": fps,
        "codec": codec,
        "container": fmt.get("format_name"),
    }
