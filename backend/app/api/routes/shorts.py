"""Готовые шортсы: список, отдача видео/превью (Range), действия, метаданные."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ...db import get_db
from ...schemas import (
    BulkResult,
    BulkShortsIn,
    ShortDetail,
    ShortMetadata,
    ShortOut,
    ShortPatch,
)
from ...services import short_service as svc
from ..ranges import guess_media_type, serve_file

router = APIRouter(prefix="/shorts", tags=["shorts"])


@router.get("", response_model=list[ShortOut])
def list_shorts(
    status: str | None = None,
    movie_id: int | None = None,
    sort: str | None = None,
    db: Session = Depends(get_db),
):
    return svc.list_shorts(db, status=status, movie_id=movie_id, sort=sort)


@router.post("/bulk", response_model=BulkResult)
def bulk(payload: BulkShortsIn, db: Session = Depends(get_db)) -> BulkResult:
    affected = svc.bulk(db, payload.ids, payload.action)
    return BulkResult(ok=True, affected=affected)


@router.get("/{short_id}", response_model=ShortDetail)
def get_short(short_id: int, db: Session = Depends(get_db)) -> ShortDetail:
    try:
        return svc.to_detail(svc.get_or_404(db, short_id))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{short_id}/metadata", response_model=ShortMetadata)
def get_metadata(short_id: int, db: Session = Depends(get_db)) -> ShortMetadata:
    try:
        return svc.to_metadata(svc.get_or_404(db, short_id))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{short_id}/subtitles")
def get_subtitles(short_id: int, db: Session = Depends(get_db)) -> dict:
    """Субтитры клипа для мягкого оверлея в плеере превью (JSON-кью)."""
    try:
        s = svc.get_or_404(db, short_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"format": "json", "cues": s.subtitles_json or []}


@router.get("/{short_id}/preview")
def get_preview(short_id: int, request: Request, db: Session = Depends(get_db)):
    s = _get(db, short_id)
    if not s.preview_path:
        raise HTTPException(status_code=404, detail="Черновой предпросмотр ещё не готов.")
    path = Path(s.preview_path)
    return serve_file(request, path, media_type=guess_media_type(path))


@router.get("/{short_id}/file")
def download_file(short_id: int, request: Request, db: Session = Depends(get_db)):
    """Скачать финал в исходном качестве (attachment, Range)."""
    s = _get(db, short_id)
    if not s.file_path:
        raise HTTPException(status_code=404, detail="Финальный рендер ещё не готов (нужно «Одобрить»).")
    path = Path(s.file_path)
    return serve_file(
        request, path, media_type=guess_media_type(path), as_attachment=True, download_name=path.name
    )


@router.get("/{short_id}/thumbnail")
def get_thumbnail(short_id: int, request: Request, db: Session = Depends(get_db)):
    s = _get(db, short_id)
    if not s.thumb_path:
        raise HTTPException(status_code=404, detail="Превью ещё не готово.")
    path = Path(s.thumb_path)
    return serve_file(request, path, media_type=guess_media_type(path))


@router.post("/{short_id}/approve", response_model=ShortOut)
def approve(short_id: int, db: Session = Depends(get_db)) -> ShortOut:
    try:
        return svc.to_out(svc.approve_short(db, short_id))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{short_id}/reject", response_model=ShortOut)
def reject(short_id: int, db: Session = Depends(get_db)) -> ShortOut:
    try:
        return svc.to_out(svc.reject_short(db, short_id))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{short_id}", response_model=ShortOut)
def patch_short(short_id: int, payload: ShortPatch, db: Session = Depends(get_db)) -> ShortOut:
    try:
        s, _ = svc.patch_short(
            db,
            short_id,
            start_ts=payload.start_ts,
            end_ts=payload.end_ts,
            subtitles_text=payload.subtitles_text,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return svc.to_out(s)


@router.delete("/{short_id}")
def delete_short(short_id: int, db: Session = Depends(get_db)) -> dict:
    try:
        svc.delete_short(db, short_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True}


def _get(db: Session, short_id: int):
    try:
        return svc.get_or_404(db, short_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
