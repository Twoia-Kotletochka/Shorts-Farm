"""Отбор top-N кандидатов: подгонка краёв, дедуп внутри запуска и между запусками."""
from __future__ import annotations

import logging

from sqlalchemy import select as sa_select
from sqlalchemy.orm import Session

from ..models import Movie, Short
from ..providers import Transcript
from . import signals
from .types import Candidate

log = logging.getLogger(__name__)


def _word_bounds(transcript: Transcript) -> list[float]:
    bounds: set[float] = set()
    for seg in transcript.segments:
        for w in seg.words:
            bounds.add(round(w.start, 3))
            bounds.add(round(w.end, 3))
    return sorted(bounds)


def _nearest(bounds: list[float], t: float, max_delta: float) -> float:
    if not bounds:
        return t
    best = min(bounds, key=lambda b: abs(b - t))
    return best if abs(best - t) <= max_delta else t


def _overlaps(a0: float, a1: float, b0: float, b1: float, thresh: float = 0.3) -> bool:
    """Существенно ли пересекаются интервалы (IoU = inter/union > thresh).

    IoU симметричен и устойчив к разнице длин: короткий кандидат внутри огромного
    интервала-конверта даёт малый IoU и НЕ считается дублем. Прежняя метрика
    (доля от кратчайшего) при таком конверте отбраковывала вообще всё, из-за чего
    повторный прогон на том же фильме выбирал 0 моментов.
    """
    inter = max(0.0, min(a1, b1) - max(a0, b0))
    if inter <= 0.0:
        return False
    union = max(a1, b1) - min(a0, b0)
    return union > 0.0 and inter / union > thresh


def _existing_intervals(s: Short) -> list[tuple[float, float]]:
    """Реальные нарезанные интервалы шортса: для compilation — список сегментов
    из metadata_json, иначе — единственный интервал [start_ts, end_ts]."""
    segs = (s.metadata_json or {}).get("segments")
    if segs:
        return [(seg["start"], seg["end"]) for seg in segs]
    return [(s.start_ts, s.end_ts)]


def _start_on_speech(word_starts: list[float], start: float, max_shift: float = 1.5) -> float:
    """Сдвинуть начало клипа вперёд к первому слову (обрезать ведущую тишину до max_shift),
    чтобы шортс открывался речью/крючком, а не мёртвым воздухом."""
    cands = [w for w in word_starts if w >= start - 0.15]
    if not cands:
        return start
    ws = min(cands)
    return max(0.0, ws) if (ws - start) <= max_shift else start


def _bucket(dur: float, dur_min: int, dur_max: int) -> int:
    """Бакет длительности (0/1/2) для разнообразия отбора."""
    if dur_max <= dur_min:
        return 0
    r = (dur - dur_min) / (dur_max - dur_min)
    return 0 if r < 1 / 3 else (1 if r < 2 / 3 else 2)


def _snap(
    c: Candidate,
    cuts: list[float],
    word_bounds: list[float],
    word_starts: list[float],
    dur_min: int,
    dur_max: int,
    movie_duration: float | None,
) -> bool:
    start = signals.nearest_cut(cuts, c.start) if cuts else c.start
    start = _nearest(word_bounds, start, 0.6)
    start = _start_on_speech(word_starts, max(0.0, start))
    start = max(0.0, start)
    end = c.end
    if end - start < dur_min:
        end = start + dur_min
    if end - start > dur_max:
        end = start + dur_max
    end = signals.nearest_cut(cuts, end) if cuts else end
    end = _nearest(word_bounds, end, 0.6)
    if movie_duration:
        end = min(end, movie_duration)
    if end - start < 1.0:
        return False
    c.start, c.end = round(start, 3), round(end, 3)
    return True


def select_moments(
    db: Session,
    movie: Movie,
    candidates: list[Candidate],
    *,
    count: int,
    target_duration: tuple[int, int],
    transcript: Transcript,
    scene_cuts: list[float] | None = None,
    allow_duplicates: bool = False,
    total_budget: float | None = None,
) -> list[Candidate]:
    dur_min, dur_max = target_duration
    cuts = scene_cuts or []
    word_bounds = _word_bounds(transcript)
    word_starts = sorted({round(w.start, 3) for seg in transcript.segments for w in seg.words})

    snapped = [c for c in candidates if _snap(c, cuts, word_bounds, word_starts, dur_min, dur_max, movie.duration)]

    existing: list[tuple[float, float]] = []
    if not allow_duplicates:
        rows = db.scalars(sa_select(Short).where(Short.movie_id == movie.id)).all()
        existing = [iv for s in rows for iv in _existing_intervals(s)]

    chosen: list[Candidate] = []
    acc = 0.0  # суммарная длительность отобранного (для бюджета компиляции)

    def _fits(c: Candidate) -> bool:
        if any(_overlaps(c.start, c.end, a, b) for a, b in existing):
            return False  # уже нарезанный момент (дедуп между запусками)
        if any(_overlaps(c.start, c.end, ch.start, ch.end) for ch in chosen):
            return False  # пересечение внутри текущего запуска
        # Бюджет (компиляция): не вылезаем за лимит; хотя бы один сегмент гарантирован (`chosen`).
        if total_budget is not None and chosen and acc + c.duration > total_budget:
            return False
        return True

    def _take(c: Candidate) -> None:
        nonlocal acc
        c.moment_id = f"{movie.id}-{int(round(c.start))}-{int(round(c.end))}"
        chosen.append(c)
        acc += c.duration

    # Разнообразие длительностей: не даём набрать все клипы из одного бакета длины
    # (иначе всё получается ~одинаковым, напр. по ~20с). Кап на бакет = ceil(count/3).
    ranked = sorted(snapped, key=lambda x: x.overall, reverse=True)
    per_bucket = max(1, -(-count // 3))
    bucket_counts = {0: 0, 1: 0, 2: 0}
    deferred: list[Candidate] = []
    for c in ranked:
        if len(chosen) >= count:
            break
        if not _fits(c):
            continue
        b = _bucket(c.duration, dur_min, dur_max)
        if bucket_counts[b] >= per_bucket:
            deferred.append(c)  # бакет полон — отложим на добор
            continue
        _take(c)
        bucket_counts[b] += 1
        if total_budget is not None and acc >= total_budget:
            break
    # добор отложенными, если из-за кап-ов не набрали count
    for c in deferred:
        if len(chosen) >= count or (total_budget is not None and acc >= total_budget):
            break
        if _fits(c):
            _take(c)

    log.info(
        "Отбор: из %d кандидатов выбрано %d (count=%d, бюджет=%s, бакеты=%s, итог≈%.1fс).",
        len(snapped), len(chosen), count,
        f"{total_budget:.0f}с" if total_budget is not None else "—", bucket_counts, acc,
    )
    return chosen
