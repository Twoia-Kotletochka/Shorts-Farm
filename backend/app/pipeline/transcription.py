"""Транскрипция фильма с кэшем (повторная генерация не жжёт Whisper-лимит заново)."""
from __future__ import annotations

import json
import logging
from collections.abc import Callable
from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..models import Movie, Transcript as TranscriptRow, TranscriptionStatus
from ..providers import (
    ProviderConfig, Transcript, TranscriptSegment, Word, build_stt, provider_has_limits,
)
from ..services import usage_service
from ..storage import sources_dir, transcripts_cache_dir
from .audio import audio_key, chunk_audio, cleanup_chunks, extract_audio

log = logging.getLogger(__name__)

ProgressCb = Callable[[float, str], None] | None


def _cache_path(file_hash: str) -> Path:
    return transcripts_cache_dir() / f"{file_hash}.json"


def _load_cache(file_hash: str) -> Transcript | None:
    path = _cache_path(file_hash)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    segments = [
        TranscriptSegment(
            start=s["start"], end=s["end"], text=s.get("text", ""),
            words=[Word(**w) for w in s.get("words", [])],
        )
        for s in data.get("segments", [])
    ]
    return Transcript(
        segments=segments,
        language=data.get("language"),
        provider=data.get("provider", ""),
        model=data.get("model", ""),
    )


def _save_cache(file_hash: str, transcript: Transcript) -> None:
    path = _cache_path(file_hash)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "language": transcript.language,
        "provider": transcript.provider,
        "model": transcript.model,
        "segments": transcript.to_json(),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _shift(transcript: Transcript, offset: float) -> None:
    for seg in transcript.segments:
        seg.start += offset
        seg.end += offset
        for w in seg.words:
            w.start += offset
            w.end += offset


def _merge(chunk_transcripts: list[tuple[Transcript, float]]) -> Transcript:
    """Склейка чанков с учётом смещения и дедупом сегментов в зоне перекрытия."""
    merged: list[TranscriptSegment] = []
    covered_until = 0.0
    language = None
    for i, (tr, offset) in enumerate(chunk_transcripts):
        language = language or tr.language
        _shift(tr, offset)
        for seg in tr.segments:
            # сегменты из зоны перекрытия уже есть из предыдущего чанка — пропускаем
            if i > 0 and seg.start < covered_until - 0.5:
                continue
            merged.append(seg)
            covered_until = max(covered_until, seg.end)
    return Transcript(segments=merged, language=language)


def transcribe_movie(
    db: Session,
    movie: Movie,
    stt_config: ProviderConfig,
    *,
    language: str | None = None,
    audio_index: int | None = None,
    progress_cb: ProgressCb = None,
    force: bool = False,
) -> Transcript:
    """Полная транскрипция фильма (с кэшем). Возвращает Transcript с word-таймкодами.

    audio_index — выбранная аудиодорожка (None → авто). Кэш отдельный на каждую дорожку.
    """
    file_hash = movie.file_hash or f"movie-{movie.id}"
    cache_key = audio_key(file_hash, audio_index)

    def progress(p: float, msg: str) -> None:
        if progress_cb:
            progress_cb(p, msg)

    # 1) кэш
    if not force:
        cached = _load_cache(cache_key)
        if cached is not None:
            log.info("Транскрипт из кэша для movie #%d (дорожка %s).", movie.id, audio_index)
            _persist(db, movie, cached)
            progress(1.0, "транскрипт из кэша")
            return cached

    movie.transcription_status = TranscriptionStatus.PENDING
    db.commit()

    movie_path = sources_dir() / movie.rel_path
    if not movie_path.exists():
        movie.transcription_status = TranscriptionStatus.ERROR
        db.commit()
        raise FileNotFoundError(f"Файл исходника не найден: {movie_path}")

    provider = build_stt(stt_config)
    audio: Path | None = None
    chunks: list = []
    try:
        progress(0.05, "извлечение аудио")
        audio = extract_audio(movie_path, file_hash, audio_index=audio_index)
        chunks = chunk_audio(audio)

        results: list[tuple[Transcript, float]] = []
        for i, chunk in enumerate(chunks):
            progress(0.1 + 0.8 * i / max(len(chunks), 1), f"транскрипция {i + 1}/{len(chunks)}")
            tr = provider.transcribe(str(chunk.path), language=language)
            results.append((tr, chunk.offset))

        merged = _merge(results)
        merged.provider = stt_config.type
        merged.model = stt_config.model

        _save_cache(cache_key, merged)
        _persist(db, movie, merged)
        # квоту списываем только за реальную транскрипцию и только у провайдера с квотами
        if provider_has_limits(stt_config.type):
            usage_service.record_seconds(db, movie.duration or 0.0)
        progress(1.0, "транскрипт готов")
        log.info("Транскрипт готов для movie #%d: %d сегментов.", movie.id, len(merged.segments))
        return merged
    except Exception:
        movie.transcription_status = TranscriptionStatus.ERROR
        db.commit()
        raise
    finally:
        # временные чанки чистим всегда (в т.ч. при падении), кэш-FLAC сохраняем
        cleanup_chunks(chunks, keep=audio)


def _persist(db: Session, movie: Movie, transcript: Transcript) -> None:
    """Сохранить транскрипт в БД (один на фильм) и пометить статус."""
    db.execute(delete(TranscriptRow).where(TranscriptRow.movie_id == movie.id))
    db.add(
        TranscriptRow(
            movie_id=movie.id,
            provider=transcript.provider or "",
            model=transcript.model or "",
            language=transcript.language,
            segments_json=transcript.to_json(),
        )
    )
    movie.transcription_status = TranscriptionStatus.DONE
    db.commit()
