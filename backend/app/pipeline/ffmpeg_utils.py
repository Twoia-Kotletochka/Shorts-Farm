"""Низкоуровневые обёртки ffmpeg/ffprobe для пайплайна."""
from __future__ import annotations

import json
import logging
import subprocess

log = logging.getLogger(__name__)


class FFmpegError(RuntimeError):
    pass


def run(cmd: list[str], *, timeout: int = 3600) -> str:
    """Запустить ffmpeg/ffprobe; вернуть stdout. Бросает FFmpegError на ненулевой код."""
    log.debug("ffmpeg cmd: %s", " ".join(cmd))
    try:
        # errors="replace": вывод ffmpeg может содержать не-UTF-8 (напр. cp1251 в метаданных дорожек)
        proc = subprocess.run(
            cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout
        )
    except FileNotFoundError as exc:
        raise FFmpegError(f"Не найдена утилита: {cmd[0]}") from exc
    except subprocess.TimeoutExpired as exc:
        raise FFmpegError(f"Таймаут команды {cmd[0]} ({timeout}s)") from exc
    if proc.returncode != 0:
        raise FFmpegError(f"{cmd[0]} код {proc.returncode}: {proc.stderr.strip()[-500:]}")
    return proc.stdout


def run_bytes(cmd: list[str], *, timeout: int = 3600) -> bytes:
    """Как run(), но возвращает бинарный stdout (например, сырой PCM)."""
    log.debug("ffmpeg(bin) cmd: %s", " ".join(cmd))
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=timeout)
    except FileNotFoundError as exc:
        raise FFmpegError(f"Не найдена утилита: {cmd[0]}") from exc
    except subprocess.TimeoutExpired as exc:
        raise FFmpegError(f"Таймаут команды {cmd[0]} ({timeout}s)") from exc
    if proc.returncode != 0:
        raise FFmpegError(f"{cmd[0]} код {proc.returncode}: {proc.stderr.decode('utf-8', 'replace')[-500:]}")
    return proc.stdout


def run_stderr(cmd: list[str], *, timeout: int = 1800) -> str:
    """Запустить и вернуть stderr (ffmpeg пишет статистику фильтров туда, напр. silencedetect)."""
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout
        )
    except FileNotFoundError as exc:
        raise FFmpegError(f"Не найдена утилита: {cmd[0]}") from exc
    except subprocess.TimeoutExpired as exc:
        raise FFmpegError(f"Таймаут команды {cmd[0]} ({timeout}s)") from exc
    return proc.stderr


def probe_duration(path: str) -> float | None:
    out = run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "json", path],
        timeout=120,
    )
    try:
        return float(json.loads(out)["format"]["duration"])
    except (KeyError, ValueError, TypeError):
        return None


def has_vaapi() -> bool:
    """Доступен ли VAAPI-энкодер h264_vaapi (для аппаратного энкода на /dev/dri)."""
    try:
        out = run(["ffmpeg", "-hide_banner", "-encoders"], timeout=30)
    except FFmpegError:
        return False
    return "h264_vaapi" in out
