"""Логика шортсов: сериализация и действия (approve/reject/delete/patch/bulk).

Правка субтитров обновляет мягкий оверлей мгновенно (без ре-рендера). Правка краёв и
«Одобрить» → финальный/повторный рендер — постановка в очередь приходит в фазах G/H.
"""
from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Short, ShortStatus
from ..schemas import Rating, ShortDetail, ShortMetadata, ShortOut

log = logging.getLogger(__name__)

_RATING_KEYS = ("overall", "retention", "emotion", "dynamics", "virality")


def _send(task_name: str, short_id: int) -> None:
    try:
        from worker.celery_app import celery

        celery.send_task(task_name, args=[short_id], queue="render")
    except Exception as exc:  # noqa: BLE001
        log.warning("Не удалось поставить %s для шортса #%s: %s", task_name, short_id, exc)


def _exists(path: str | None) -> bool:
    return bool(path) and Path(path).exists()


def _rev(s: Short) -> int:
    """Версия файлов шортса (max mtime) — для cache-busting превью/финала на фронте."""
    rev = 0
    for p in (s.preview_path, s.file_path):
        if p and Path(p).exists():
            try:
                rev = max(rev, int(Path(p).stat().st_mtime * 1000))  # мс: различать ре-рендеры в одну секунду
            except OSError:
                pass
    return rev


def to_out(s: Short) -> ShortOut:
    r = s.rating_json or {}
    return ShortOut(
        id=s.id,
        job_id=s.job_id,
        movie_id=s.movie_id,
        moment_id=s.moment_id,
        variant_no=s.variant_no,
        status=s.status,
        category=s.category,
        hook_title=s.hook_title,
        rating=Rating(**{k: float(r.get(k, 0.0) or 0.0) for k in _RATING_KEYS}),
        reason=s.reason,
        duration=s.duration,
        start_ts=s.start_ts,
        end_ts=s.end_ts,
        has_preview=_exists(s.preview_path),
        has_final=_exists(s.file_path),
        rev=_rev(s),
        created_at=s.created_at,
    )


def to_metadata(s: Short) -> ShortMetadata:
    md = s.metadata_json or {}
    return ShortMetadata(
        title=md.get("title", ""),
        description=md.get("description", ""),
        hashtags=md.get("hashtags", []) or [],
        first_comment=md.get("first_comment", ""),
        variants=md.get("variants", []) or [],
    )


def to_detail(s: Short) -> ShortDetail:
    base = to_out(s).model_dump()
    return ShortDetail(**base, metadata=to_metadata(s))


def list_shorts(
    db: Session, *, status: str | None = None, movie_id: int | None = None, sort: str | None = None
) -> list[ShortOut]:
    query = select(Short)
    if status:
        query = query.where(Short.status == status)
    if movie_id:
        query = query.where(Short.movie_id == movie_id)
    query = query.order_by(Short.created_at.desc())
    rows = db.scalars(query).all()
    out = [to_out(s) for s in rows]
    if sort == "rating":
        out.sort(key=lambda x: x.rating.overall, reverse=True)
    return out


def get_or_404(db: Session, short_id: int) -> Short:
    s = db.get(Short, short_id)
    if s is None:
        raise LookupError("Шортс не найден.")
    return s


def patch_short(db: Session, short_id: int, *, start_ts=None, end_ts=None, subtitles_text=None) -> tuple[Short, bool]:
    """→ (short, needs_rerender). Правка текста субтитров ре-рендера не требует."""
    s = get_or_404(db, short_id)
    needs_rerender = False
    if subtitles_text is not None:
        # ручная правка субтитров — сохраняем как override; прожигается при ре-рендере
        md = dict(s.metadata_json or {})
        md["subtitles_text"] = subtitles_text
        s.metadata_json = md
        needs_rerender = True
    if start_ts is not None:
        s.start_ts = start_ts
        needs_rerender = True
    if end_ts is not None:
        s.end_ts = end_ts
        needs_rerender = True
    if start_ts is not None or end_ts is not None:
        s.duration = max(0.0, (s.end_ts or 0.0) - (s.start_ts or 0.0))
    db.commit()
    db.refresh(s)
    if needs_rerender:
        _send("shorts.rerender", short_id)  # правка краёв → перерендер (финал, если он уже был)
    return s, needs_rerender


def approve_short(db: Session, short_id: int) -> Short:
    s = get_or_404(db, short_id)
    s.status = ShortStatus.APPROVED
    db.commit()
    db.refresh(s)
    _send("shorts.render_final", short_id)  # финальный рендер: прожиг субтитров + эффекты
    return s


def reject_short(db: Session, short_id: int) -> Short:
    s = get_or_404(db, short_id)
    s.status = ShortStatus.REJECTED
    db.commit()
    db.refresh(s)
    return s


def _remove_files(s: Short) -> None:
    for path in (s.preview_path, s.file_path, s.thumb_path):
        if path and Path(path).exists():
            try:
                Path(path).unlink()
            except OSError as exc:
                log.warning("Не удалось удалить файл %s: %s", path, exc)


def delete_short(db: Session, short_id: int) -> None:
    s = get_or_404(db, short_id)
    _remove_files(s)
    db.delete(s)
    db.commit()


def bulk(db: Session, ids: list[int], action: str) -> int:
    affected = 0
    approved_ids: list[int] = []
    for sid in ids:
        s = db.get(Short, sid)
        if s is None:
            continue
        if action == "approve":
            s.status = ShortStatus.APPROVED
            approved_ids.append(sid)
        elif action == "reject":
            s.status = ShortStatus.REJECTED
        elif action == "delete":
            _remove_files(s)
            db.delete(s)
        affected += 1
    db.commit()
    for sid in approved_ids:  # финал только для реально одобренных (существующих)
        _send("shorts.render_final", sid)
    return affected
