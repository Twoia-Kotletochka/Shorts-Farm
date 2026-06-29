"""Обслуживание: контроль диска, LRU-вытеснение кэша, ретеншн черновиков."""
from __future__ import annotations

import logging
from datetime import timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Short, ShortStatus, utcnow
from ..storage import audio_cache_dir, disk_usage_gb, transcripts_cache_dir

log = logging.getLogger(__name__)

MIN_FREE_GB = 5.0


def free_gb() -> float:
    return disk_usage_gb()[0]


def lru_evict_cache(target_free_gb: float) -> int:
    """Удалять самые старые файлы кэша (audio, transcripts), пока не наберём место. → удалено файлов."""
    files: list[Path] = []
    for d in (audio_cache_dir(), transcripts_cache_dir()):
        if d.exists():
            files.extend(p for p in d.iterdir() if p.is_file())
    files.sort(key=lambda p: p.stat().st_mtime)  # старые первыми

    removed = 0
    for f in files:
        if free_gb() >= target_free_gb:
            break
        try:
            f.unlink()
            removed += 1
        except OSError:
            pass
    if removed:
        log.warning("LRU-чистка кэша: удалено %d файлов.", removed)
    return removed


def ensure_disk(min_gb: float = MIN_FREE_GB) -> bool:
    """Достаточно ли места; при нехватке — чистка кэша. → True, если место есть."""
    if free_gb() >= min_gb:
        return True
    lru_evict_cache(min_gb)
    ok = free_gb() >= min_gb
    if not ok:
        log.error("Недостаточно места на диске: свободно %.1f ГБ (< %.1f).", free_gb(), min_gb)
    return ok


def retention_sweep(db: Session, days: int) -> int:
    """Удалить отклонённые и старые черновики (старше N дней) вместе с файлами. → удалено шортсов."""
    if not days or days <= 0:
        return 0
    cutoff = utcnow() - timedelta(days=days)
    rows = db.scalars(
        select(Short).where(
            (Short.status == ShortStatus.REJECTED)
            | ((Short.status == ShortStatus.DRAFT) & (Short.created_at < cutoff))
        )
    ).all()
    count = 0
    for s in rows:
        for path in (s.preview_path, s.file_path, s.thumb_path):
            if path and Path(path).exists():
                try:
                    Path(path).unlink()
                except OSError:
                    pass
        db.delete(s)
        count += 1
    db.commit()
    if count:
        log.info("Ретеншн: удалено %d шортсов (отклонённые/старше %d дн).", count, days)
    return count
