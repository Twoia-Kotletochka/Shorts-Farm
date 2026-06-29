"""Логика задач генерации.

На фазе D задача создаётся и сохраняется (история/повтор работают), но в очередь Celery
ещё не ставится — реальный пайплайн и постановка приходят в фазах E–H (enqueue_job).
"""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Job, JobStatus, Movie, Profile
from ..providers import provider_has_limits
from ..schemas import JobBatchIn, JobCreate
from . import settings_service as ss

log = logging.getLogger(__name__)


def enqueue_job(job: Job) -> None:
    """Поставить задачу генерации в очередь (с приоритетом). По имени — без импорта пайплайна."""
    try:
        from worker.celery_app import celery

        result = celery.send_task("jobs.run", args=[job.id], queue="network", priority=job.priority)
        job.celery_task_id = result.id
    except Exception as exc:  # noqa: BLE001
        log.warning("Не удалось поставить задачу #%s в очередь: %s", job.id, exc)


def _build_params(payload: JobCreate, profile: Profile | None) -> dict:
    """Приоритет значений: явно заданные пользователем > профиль > дефолты схемы."""
    full = payload.model_dump()
    explicit = payload.model_dump(exclude_unset=True)
    params = dict(full)
    if profile and profile.params_json:
        params.update(profile.params_json)
    params.update(explicit)
    params["movie_id"] = payload.movie_id
    return params


def create_job(db: Session, payload: JobCreate) -> Job:
    movie = db.get(Movie, payload.movie_id)
    if movie is None:
        raise LookupError("Фильм не найден.")

    profile = db.get(Profile, payload.profile_id) if payload.profile_id else None
    params = _build_params(payload, profile)
    priority = payload.priority if payload.priority is not None else 5

    job = Job(
        movie_id=payload.movie_id,
        type="generate",
        params_json=params,
        priority=priority,
        status=JobStatus.QUEUED,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    enqueue_job(job)
    db.commit()
    log.info("Создана задача #%d для movie #%d.", job.id, job.movie_id)
    return job


def repeat_job(db: Session, job_id: int) -> Job:
    src = db.get(Job, job_id)
    if src is None:
        raise LookupError("Задача не найдена.")
    params = dict(src.params_json or {})
    job = Job(
        movie_id=src.movie_id,
        type=src.type,
        params_json=params,
        priority=params.get("priority") or 5,
        status=JobStatus.QUEUED,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    enqueue_job(job)
    db.commit()
    return job


def cancel_job(db: Session, job_id: int) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise LookupError("Задача не найдена.")
    if job.status in (JobStatus.DONE, JobStatus.FAILED, JobStatus.CANCELED):
        return job
    job.status = JobStatus.CANCELED
    if job.celery_task_id:
        try:
            from worker.celery_app import celery

            celery.control.revoke(job.celery_task_id, terminate=False)
        except Exception as exc:  # noqa: BLE001
            log.warning("Не удалось revoke задачи %s: %s", job.celery_task_id, exc)
    db.commit()
    db.refresh(job)
    return job


def set_priority(db: Session, job_id: int, priority: int) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise LookupError("Задача не найдена.")
    job.priority = priority
    db.commit()
    db.refresh(job)
    return job


def estimate(db: Session, movie_id: int) -> dict:
    """Прикидка расхода Whisper. Для безлимитных провайдеров — no-op."""
    stt = ss.get_provider_config(db, "stt")
    if not provider_has_limits(stt.type):
        return {"unlimited": True}
    movie = db.get(Movie, movie_id)
    needed = float(movie.duration) if movie and movie.duration else None
    from .usage_service import remaining_seconds

    remaining = remaining_seconds(db)
    fits = needed is None or needed <= remaining
    return {
        "whisper_audio_sec_needed": needed,
        "fits_today": fits,
        "unlimited": False,
    }


def resolve_batch_movie_ids(db: Session, payload: JobBatchIn) -> list[int]:
    if payload.movie_ids:
        return list(payload.movie_ids)
    query = select(Movie.id)
    if payload.series:
        query = query.where(Movie.series == payload.series)
    if payload.season is not None:
        query = query.where(Movie.season == payload.season)
    query = query.order_by(Movie.season, Movie.episode, Movie.title)
    return list(db.scalars(query).all())


def create_batch(db: Session, payload: JobBatchIn) -> list[int]:
    movie_ids = resolve_batch_movie_ids(db, payload)
    base = payload.model_dump(exclude={"series", "season", "movie_ids"})
    priority = base.get("priority") if base.get("priority") is not None else 5

    jobs: list[Job] = []
    for movie_id in movie_ids:
        params = dict(base)
        params["movie_id"] = movie_id
        job = Job(
            movie_id=movie_id,
            type="generate",
            params_json=params,
            priority=priority,
            status=JobStatus.QUEUED,
        )
        db.add(job)
        jobs.append(job)
    db.commit()
    for job in jobs:
        enqueue_job(job)
    db.commit()
    log.info("Пакет: создано %d задач.", len(jobs))
    return [job.id for job in jobs]
