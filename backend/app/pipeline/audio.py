"""Извлечение аудио и нарезка на чанки под лимит провайдера (Groq 25 МБ)."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from ..storage import audio_cache_dir
from .ffmpeg_utils import FFmpegError, probe_duration, run

log = logging.getLogger(__name__)

SAMPLE_RATE = 16000
GROQ_MAX_BYTES = 25 * 1024 * 1024
SAFE_FRACTION = 0.9          # запас под лимит
OVERLAP_SEC = 5.0            # перекрытие чанков, чтобы не терять слова на стыке


@dataclass
class AudioChunk:
    path: Path
    offset: float  # абсолютное смещение начала чанка в полном аудио (сек)


def audio_key(file_hash: str, audio_index: int | None) -> str:
    """Ключ кэша аудио/транскрипта. Разные дорожки → разные ключи."""
    return file_hash if audio_index is None else f"{file_hash}-a{audio_index}"


def extract_audio(
    movie_path: Path, file_hash: str, *, audio_index: int | None = None, force: bool = False
) -> Path:
    """ffmpeg → 16 кГц моно FLAC в cache/audio. Кэш по хешу файла + индексу дорожки.

    audio_index — относительный индекс аудиодорожки (0:a:N). None → ffmpeg сам выберет «лучшую».
    """
    out = audio_cache_dir() / f"{audio_key(file_hash, audio_index)}.flac"
    if out.exists() and not force and out.stat().st_size > 0:
        log.info("Аудио из кэша: %s", out.name)
        return out
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", str(movie_path)]
    if audio_index is not None:
        cmd += ["-map", f"0:a:{audio_index}"]
    cmd += ["-vn", "-ac", "1", "-ar", str(SAMPLE_RATE), "-c:a", "flac", str(out)]
    run(cmd)
    log.info("Аудио извлечено: %s (%.1f МБ)", out.name, out.stat().st_size / 1024 / 1024)
    return out


def chunk_audio(
    audio_path: Path,
    *,
    max_bytes: int = GROQ_MAX_BYTES,
    overlap_sec: float = OVERLAP_SEC,
) -> list[AudioChunk]:
    """Разбить аудио на чанки, влезающие в лимит запроса. Один чанк, если файл мал."""
    size = audio_path.stat().st_size
    if size <= int(max_bytes * SAFE_FRACTION):
        return [AudioChunk(path=audio_path, offset=0.0)]

    duration = probe_duration(str(audio_path))
    if not duration:
        raise FFmpegError(f"Не удалось определить длительность аудио: {audio_path}")

    bytes_per_sec = size / duration
    base_sec = max(30.0, (max_bytes * SAFE_FRACTION) / bytes_per_sec)

    chunks: list[AudioChunk] = []
    idx = 0
    start = 0.0
    while start < duration - 0.5:
        chunk_path = audio_path.with_name(f"{audio_path.stem}.part{idx:03d}.flac")
        # FLAC сжимает по-разному (громкие участки — хуже): фактический размер может превысить
        # лимит даже при оценке по среднему битрейту. Уменьшаем длительность, пока чанк не влезет.
        cur = base_sec
        for _ in range(5):
            run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                "-ss", f"{start:.3f}", "-t", f"{cur:.3f}",
                "-i", str(audio_path),
                "-ac", "1", "-ar", str(SAMPLE_RATE), "-c:a", "flac",
                str(chunk_path),
            ])
            if not (chunk_path.exists() and chunk_path.stat().st_size > 0):
                break
            if chunk_path.stat().st_size <= max_bytes or cur <= 30.0:
                break
            cur *= 0.6  # чанк не влез → короче и заново
        if not (chunk_path.exists() and chunk_path.stat().st_size > 0):
            break  # чанк не создался — дальше тоже не выйдет; не оставляем пропусков аудио
        chunks.append(AudioChunk(path=chunk_path, offset=start))
        idx += 1
        # шаг = фактически покрытая длительность минус перекрытие (без пропусков)
        start += max(10.0, cur - overlap_sec)

    log.info("Аудио нарезано на %d чанков.", len(chunks))
    return chunks


def cleanup_chunks(chunks: list[AudioChunk], keep: Path) -> None:
    """Удалить временные чанки, кроме основного кэш-файла."""
    for ch in chunks:
        if ch.path != keep and ".part" in ch.path.name:
            try:
                ch.path.unlink(missing_ok=True)
            except OSError:
                pass
