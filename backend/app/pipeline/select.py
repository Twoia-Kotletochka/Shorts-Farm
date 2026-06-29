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
    inter = max(0.0, min(a1, b1) - max(a0, b0))
    shortest = min(a1 - a0, b1 - b0)
    return shortest > 0 and inter > thresh * shortest


def _snap(
    c: Candidate,
    cuts: list[float],
    word_bounds: list[float],
    dur_min: int,
    dur_max: int,
    movie_duration: float | None,
) -> bool:
    start = signals.nearest_cut(cuts, c.start) if cuts else c.start
    start = _nearest(word_bounds, start, 0.6)
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
) -> list[Candidate]:
    dur_min, dur_max = target_duration
    cuts = scene_cuts or []
    word_bounds = _word_bounds(transcript)

    snapped = [c for c in candidates if _snap(c, cuts, word_bounds, dur_min, dur_max, movie.duration)]

    existing: list[tuple[float, float]] = []
    if not allow_duplicates:
        rows = db.scalars(sa_select(Short).where(Short.movie_id == movie.id)).all()
        existing = [(s.start_ts, s.end_ts) for s in rows]

    chosen: list[Candidate] = []
    for c in sorted(snapped, key=lambda x: x.overall, reverse=True):
        if any(_overlaps(c.start, c.end, a, b) for a, b in existing):
            continue  # уже нарезанный момент (дедуп между запусками)
        if any(_overlaps(c.start, c.end, ch.start, ch.end) for ch in chosen):
            continue  # пересечение внутри текущего запуска
        c.moment_id = f"{movie.id}-{int(round(c.start))}-{int(round(c.end))}"
        chosen.append(c)
        if len(chosen) >= count:
            break

    log.info("Отбор: из %d кандидатов выбрано %d (count=%d).", len(snapped), len(chosen), count)
    return chosen
