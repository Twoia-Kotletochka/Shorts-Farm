"""Дешёвые на CPU сигналы для скоринга: аудио-энергия, плотность склеек, плотность диалога.

Подмешиваются к рейтингу/отбору. Чисто текстовый анализ упускает смех/крики/экшен —
аудио-пики их ловят; склейки и частота реплик — признаки динамики/напряжения.
"""
from __future__ import annotations

import logging

import numpy as np

from ..providers import TranscriptSegment
from .ffmpeg_utils import FFmpegError, run, run_bytes

log = logging.getLogger(__name__)

SR = 16000


def audio_energy_envelope(audio_path: str, window_sec: float = 1.0) -> tuple[np.ndarray, float]:
    """RMS-энергия по окнам. → (массив RMS на окно, window_sec). Нормализована к 0..1."""
    try:
        raw = run_bytes(
            ["ffmpeg", "-v", "error", "-i", audio_path,
             "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
            timeout=1800,
        )
    except FFmpegError as exc:
        log.warning("Не удалось получить PCM для энергии: %s", exc)
        return np.array([]), window_sec

    if not raw:
        return np.array([]), window_sec
    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    win = max(1, int(SR * window_sec))
    n = len(samples) // win
    if n == 0:
        return np.array([]), window_sec
    frames = samples[: n * win].reshape(n, win)
    rms = np.sqrt((frames ** 2).mean(axis=1))
    peak = float(rms.max()) if rms.size else 0.0
    if peak > 0:
        rms = rms / peak
    return rms, window_sec


def energy_in_range(rms: np.ndarray, window_sec: float, start: float, end: float) -> float:
    """Средняя нормализованная энергия в интервале [start, end] (0..1)."""
    if rms.size == 0 or end <= start:
        return 0.0
    i0 = max(0, int(start / window_sec))
    i1 = min(rms.size, int(end / window_sec) + 1)
    if i1 <= i0:
        return float(rms[min(i0, rms.size - 1)])
    return float(rms[i0:i1].mean())


def scene_cuts(video_path: str, threshold: float = 27.0) -> list[float]:
    """Границы сцен (сек) через PySceneDetect. Пусто при ошибке/недоступности."""
    try:
        from scenedetect import ContentDetector, detect

        scenes = detect(video_path, ContentDetector(threshold=threshold))
        cuts = sorted({round(s[0].get_seconds(), 3) for s in scenes})
        log.info("Найдено сцен: %d", len(cuts))
        return cuts
    except Exception as exc:  # noqa: BLE001
        log.warning("scene_detect не выполнен: %s", exc)
        return []


def cut_density_in_range(cuts: list[float], start: float, end: float) -> float:
    """Склеек в секунду на интервале (грубый признак динамики)."""
    if not cuts or end <= start:
        return 0.0
    count = sum(1 for c in cuts if start <= c <= end)
    return count / (end - start)


def dialogue_density(segments: list[TranscriptSegment], start: float, end: float) -> float:
    """Слов в секунду на интервале (признак насыщенности диалогом)."""
    if end <= start:
        return 0.0
    words = 0
    for seg in segments:
        if seg.end < start or seg.start > end:
            continue
        words += len(seg.words) or len(seg.text.split())
    return words / (end - start)


def nearest_cut(cuts: list[float], t: float, max_delta: float = 1.5) -> float:
    """Ближайшая граница сцены к t (в пределах max_delta), иначе сам t — для подгонки краёв."""
    if not cuts:
        return t
    best = min(cuts, key=lambda c: abs(c - t))
    return best if abs(best - t) <= max_delta else t
