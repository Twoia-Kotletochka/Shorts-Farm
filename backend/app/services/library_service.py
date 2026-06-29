"""Скан библиотеки: рекурсивный обход sources/ с извлечением метаданных.

Видео — по расширениям; не-видео (субтитры, .nfo, сэмплы) игнорируем. Пути относительные.
Сериал/сезон/серия извлекаются эвристически из пути/имени; как минимум — каждый файл с rel_path.
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Movie, MovieStatus, TranscriptionStatus
from ..storage import sources_dir
from .media import VIDEO_EXTENSIONS, ProbeError, ffprobe

log = logging.getLogger(__name__)

_SXXEYY = re.compile(r"[Ss](\d{1,2})[ ._-]*[Ee](\d{1,2})")
_ALT = re.compile(r"(?<!\d)(\d{1,2})[xX](\d{1,2})(?!\d)")
_SAMPLE = re.compile(r"(^|[ ._-])sample([ ._-]|$)", re.IGNORECASE)


def _clean(name: str | None) -> str:
    if not name:
        return ""
    text = re.sub(r"[._]+", " ", name)
    text = re.sub(r"\s{2,}", " ", text).strip(" -_")
    return text


def parse_name(rel_path: str, stem: str) -> dict:
    parts = [p for p in rel_path.replace("\\", "/").split("/") if p]
    folder = parts[0] if len(parts) > 1 else None

    m = _SXXEYY.search(stem) or _ALT.search(stem)
    if m:
        season, episode = int(m.group(1)), int(m.group(2))
        series = _clean(folder) if folder else _clean(stem[: m.start()])
        series = series or None
        label = f"S{season:02d}E{episode:02d}"
        title = f"{series} — {label}" if series else label
        return {"title": title, "series": series, "season": season, "episode": episode}

    title = _clean(folder) if folder else _clean(stem)
    return {"title": title or stem, "series": None, "season": None, "episode": None}


def quick_signature(path: Path, size: int) -> str:
    """Дешёвая сигнатура файла (size + первый/последний МБ) — ключ кэша транскрипта."""
    h = hashlib.sha1()
    h.update(str(size).encode())
    mb = 1024 * 1024
    try:
        with open(path, "rb") as fh:
            h.update(fh.read(mb))
            if size > 2 * mb:
                fh.seek(-mb, os.SEEK_END)
                h.update(fh.read(mb))
    except OSError as exc:
        log.warning("Не удалось прочитать %s для сигнатуры: %s", path, exc)
    return h.hexdigest()


def _walk_videos(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        # пропускаем скрытые папки
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for fn in filenames:
            ext = Path(fn).suffix.lower()
            if ext not in VIDEO_EXTENSIONS:
                continue
            if _SAMPLE.search(fn):
                continue
            yield Path(dirpath) / fn


def _backfill_metadata(movie: Movie, path: Path) -> None:
    """Дозаполнить новые поля у ранее отсканированного фильма (напр. audio_tracks)."""
    md = dict(movie.metadata_json or {})
    if md.get("audio_tracks"):
        return  # уже есть — не трогаем
    try:
        probe = ffprobe(str(path))
    except ProbeError as exc:
        log.warning("Бэкфилл ffprobe не удался для %s: %s", movie.rel_path, exc)
        return
    md["audio_tracks"] = probe.get("audio_tracks", [])
    md.setdefault("codec", probe.get("codec"))
    md.setdefault("container", probe.get("container"))
    movie.metadata_json = md  # новый объект → SQLAlchemy увидит изменение
    if not movie.duration:
        movie.duration = probe.get("duration")
    if not movie.width:
        movie.width = probe.get("width")
        movie.height = probe.get("height")
        movie.fps = probe.get("fps")
    log.info("Бэкфилл audio_tracks для %s: %d дорожек.", movie.rel_path, len(md["audio_tracks"]))


def scan_library(db: Session) -> tuple[int, int]:
    """→ (added, total_found)."""
    root = sources_dir()
    if not root.exists():
        return 0, 0

    existing = {m.rel_path: m for m in db.scalars(select(Movie)).all()}

    found = 0
    added = 0
    for path in _walk_videos(root):
        rel = str(path.relative_to(root))
        found += 1
        if rel in existing:
            _backfill_metadata(existing[rel], path)  # дозаполнить новые поля (напр. audio_tracks)
            continue

        stem = path.stem
        info = parse_name(rel, stem)
        try:
            size = path.stat().st_size
        except OSError:
            size = None

        probe: dict = {}
        status = MovieStatus.NEW
        try:
            probe = ffprobe(str(path))
        except ProbeError as exc:
            log.warning("ffprobe не смог обработать %s: %s", rel, exc)
            status = MovieStatus.ERROR

        movie = Movie(
            rel_path=rel,
            title=info["title"],
            series=info["series"],
            season=info["season"],
            episode=info["episode"],
            duration=probe.get("duration"),
            width=probe.get("width"),
            height=probe.get("height"),
            fps=probe.get("fps"),
            file_size=size,
            file_hash=quick_signature(path, size) if size else None,
            status=status,
            transcription_status=TranscriptionStatus.NONE,
            metadata_json={
                "codec": probe.get("codec"),
                "container": probe.get("container"),
                "audio_tracks": probe.get("audio_tracks", []),
            },
        )
        db.add(movie)
        existing[rel] = movie
        added += 1

    db.commit()
    log.info("Скан библиотеки: найдено %d, добавлено %d.", found, added)
    return added, found
