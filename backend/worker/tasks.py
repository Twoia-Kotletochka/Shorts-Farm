"""Celery-задачи генерации и обслуживания. Связывают стадии пайплайна (фаза H).

Очереди: network (транскрипция/анализ + черновой рендер), render (финальный рендер).
"""
from __future__ import annotations

import logging

from celery.signals import worker_ready
from sqlalchemy import select

from app.db import SessionLocal
from app.services import settings_service as ss

from .celery_app import celery

log = logging.getLogger(__name__)


@worker_ready.connect
def _recover_on_startup(**_kwargs) -> None:
    """После (пере)старта воркера пере-ставим зависшие финалы: approved без файла —
    задача финального рендера могла потеряться при рестарте (acks_late не спасает,
    если задача не дошла до брокера). После рестарта ничего не выполняется → дублей нет."""
    try:
        from app.models import Short, ShortStatus

        db = SessionLocal()
        try:
            ids = db.scalars(
                select(Short.id).where(
                    Short.status == ShortStatus.APPROVED, Short.file_path.is_(None)
                )
            ).all()
            for sid in ids:
                celery.send_task("shorts.render_final", args=[sid], queue="render")
            if ids:
                log.info("Старт: пере-постановка %d зависших финалов.", len(ids))
        finally:
            db.close()
    except Exception:  # noqa: BLE001
        log.exception("Стартовое восстановление не удалось")


@celery.task(name="jobs.run", queue="network", acks_late=True)
def run_job_task(job_id: int) -> None:
    from app.pipeline.generate import run_generation

    run_generation(job_id)


@celery.task(name="shorts.render_final", queue="render", acks_late=True)
def render_final_task(short_id: int) -> None:
    from app.pipeline.generate import run_final_render

    run_final_render(short_id)


@celery.task(name="shorts.rerender", queue="render", acks_late=True)
def rerender_task(short_id: int) -> None:
    from app.pipeline.generate import rerender_short

    rerender_short(short_id)


@celery.task(name="maintenance.retention")
def retention_task() -> None:
    from app.pipeline.maintenance import retention_sweep

    db = SessionLocal()
    try:
        days = int(ss.get_value(db, "retention_days", 14) or 0)
        retention_sweep(db, days)
    finally:
        db.close()


@celery.task(name="maintenance.recover")
def recover_task() -> None:
    """Вернуть в очередь задачи, ждавшие сброса квоты провайдера (квота сбрасывается по UTC)."""
    from app.models import Job, JobStatus
    from app.services.job_service import enqueue_job

    db = SessionLocal()
    try:
        jobs = db.scalars(select(Job).where(Job.status == JobStatus.WAITING_LIMIT)).all()
        for job in jobs:
            job.status = JobStatus.QUEUED
            enqueue_job(job, db)  # сам коммитит
        if jobs:
            log.info("Восстановление: %d задач из ожидания лимита возвращены в очередь.", len(jobs))
    finally:
        db.close()


@celery.task(name="maintenance.backup")
def backup_task() -> None:
    from app.services.backup_service import make_backup

    db = SessionLocal()
    try:
        backup = ss.get_value(db, "backup", {}) or {}
        if backup.get("enabled"):
            make_backup(db)
    finally:
        db.close()
