"""Задачи генерации."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import Job
from ...schemas import (
    BulkResult,
    JobBatchIn,
    JobBatchOut,
    JobBulkIn,
    JobCreate,
    JobCreated,
    JobDeleteResult,
    JobEstimate,
    JobOut,
    PriorityIn,
)
from ...services import job_service

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", response_model=JobCreated)
def create_job(payload: JobCreate, db: Session = Depends(get_db)) -> JobCreated:
    try:
        job = job_service.create_job(db, payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return JobCreated(job_id=job.id)


@router.get("", response_model=list[JobOut])
def list_jobs(db: Session = Depends(get_db)):
    return db.scalars(select(Job).order_by(Job.created_at.desc())).all()


# Статические пути — до параметризованного /{job_id}.
@router.post("/estimate", response_model=JobEstimate)
def estimate(payload: JobCreate, db: Session = Depends(get_db)) -> JobEstimate:
    try:
        return JobEstimate(**job_service.estimate(db, payload.movie_id))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/batch", response_model=JobBatchOut)
def batch(payload: JobBatchIn, db: Session = Depends(get_db)) -> JobBatchOut:
    try:
        job_ids = job_service.create_batch(db, payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JobBatchOut(job_ids=job_ids)


@router.post("/bulk", response_model=BulkResult)
def bulk(payload: JobBulkIn, db: Session = Depends(get_db)) -> BulkResult:
    affected = job_service.bulk_jobs(db, payload.ids, payload.action, delete_shorts=payload.delete_shorts)
    return BulkResult(ok=True, affected=affected)


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: Session = Depends(get_db)) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Задача не найдена.")
    return job


@router.post("/{job_id}/cancel", response_model=JobOut)
def cancel_job(job_id: int, db: Session = Depends(get_db)) -> Job:
    try:
        return job_service.cancel_job(db, job_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{job_id}/priority", response_model=JobOut)
def set_priority(job_id: int, payload: PriorityIn, db: Session = Depends(get_db)) -> Job:
    try:
        return job_service.set_priority(db, job_id, payload.priority)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{job_id}/repeat", response_model=JobCreated)
def repeat_job(job_id: int, db: Session = Depends(get_db)) -> JobCreated:
    try:
        job = job_service.repeat_job(db, job_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return JobCreated(job_id=job.id)


@router.delete("/{job_id}", response_model=JobDeleteResult)
def delete_job(
    job_id: int, delete_shorts: bool = False, db: Session = Depends(get_db)
) -> JobDeleteResult:
    """Удалить задачу (сломанную/ненужную). delete_shorts=true — удалить и её готовые ролики."""
    try:
        deleted = job_service.delete_job(db, job_id, delete_shorts=delete_shorts)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return JobDeleteResult(ok=True, deleted_shorts=deleted)
