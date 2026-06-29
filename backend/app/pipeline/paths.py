"""Пути и имена готовых шортсов: shorts/<источник>/[S01E03]/<осмысленное имя>."""
from __future__ import annotations

import re
from pathlib import Path

from ..models import Movie
from ..storage import shorts_dir, thumbnails_dir


def slug(text: str | None, maxlen: int = 60) -> str:
    if not text:
        return "clip"
    s = re.sub(r"[^\w\-]+", "_", text, flags=re.UNICODE)
    s = re.sub(r"_{2,}", "_", s).strip("_")
    return (s[:maxlen] or "clip")


def movie_subdir(movie: Movie) -> Path:
    base = shorts_dir() / slug(movie.series or movie.title)
    if movie.season is not None and movie.episode is not None:
        base = base / f"S{movie.season:02d}E{movie.episode:02d}"
    return base


def clip_basename(movie: Movie, start: float, end: float, category: str | None) -> str:
    cat = slug(category, 24) if category else "clip"
    return f"{slug(movie.title, 48)}_{int(start)}-{int(end)}_{cat}"


def thumb_path(basename: str) -> Path:
    return thumbnails_dir() / f"{basename}.jpg"
