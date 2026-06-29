"""Логика задач генерации.

На фазе D задача создаётся и сохраняется (история/повтор работают), но в очередь Celery
ещё не ставится — реальный пайплайн и постановка приходят в фазах E–H (enqueue_job).
"""
from __future__ import annotations

import logging

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from ..models import Job, JobStatus, Movie, Profile, Short
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


_ACTIVE = (JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.WAITING_LIMIT)


def _revoke(job: Job, *, terminate: bool) -> None:
    if job.celery_task_id:
        try:
            from worker.celery_app import celery

            celery.control.revoke(job.celery_task_id, terminate=terminate)
        except Exception as exc:  # noqa: BLE001
            log.warning("revoke %s не удался: %s", job.celery_task_id, exc)


def delete_job(db: Session, job_id: int, *, delete_shorts: bool = False) -> int:
    """Удалить задачу (сломанную/ненужную). delete_shorts=True — удалить и её готовые ролики (с файлами).

    delete_shorts=False — ролики сохраняются (отвязываются: job_id=NULL). → число удалённых шортсов.
    """
    job = db.get(Job, job_id)
    if job is None:
        raise LookupError("Задача не найдена.")
    if job.status in _ACTIVE:
        job.status = JobStatus.CANCELED
        db.commit()
        _revoke(job, terminate=True)  # снять выполняющуюся/ожидающую задачу

    deleted = 0
    if delete_shorts:
        from .short_service import _remove_files

        for s in db.scalars(select(Short).where(Short.job_id == job_id)).all():
            _remove_files(s)
            db.delete(s)
            deleted += 1
        db.flush()
    else:
        # сохранить ролики — отвязать от задачи (FK nullable), чтобы каскад их не снёс
        db.execute(update(Short).where(Short.job_id == job_id).values(job_id=None))

    # core-delete, минуя ORM-каскад delete-orphan (детей уже нет или отвязали)
    db.execute(delete(Job).where(Job.id == job_id))
    db.commit()
    log.info("Задача #%d удалена (с роликами=%s, удалено %d).", job_id, delete_shorts, deleted)
    return deleted


def bulk_jobs(db: Session, ids: list[int], action: str, *, delete_shorts: bool = False) -> int:
    affected = 0
    for jid in ids:
        try:
            if action == "delete":
                delete_job(db, jid, delete_shorts=delete_shorts)
            elif action == "cancel":
                cancel_job(db, jid)
            affected += 1
        except LookupError:
            continue
    return affected


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
    movie = db.get(Movie, movie_id)
    if movie is None:
        raise LookupError("Фильм не найден.")
    stt = ss.get_provider_config(db, "stt")
    if not provider_has_limits(stt.type):
        return {"unlimited": True}
    needed = float(movie.duration) if movie.duration else None
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
        ids = list(dict.fromkeys(payload.movie_ids))  # уникальные, порядок сохранён
        existing = set(db.scalars(select(Movie.id).where(Movie.id.in_(ids))).all())
        missing = [i for i in ids if i not in existing]
        if missing:
            raise LookupError(f"Фильмы не найдены: {missing}")
        return ids
    # без movie_ids нужен хотя бы фильтр — иначе пакет накроет ВСЮ библиотеку
    if not payload.series and payload.season is None:
        raise ValueError("Пакет требует movie_ids, либо series, либо season.")
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
