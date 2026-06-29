"""Celery-задачи генерации и обслуживания. Связывают стадии пайплайна (фаза H).

Очереди: network (транскрипция/анализ + черновой рендер), render (финальный рендер).
"""
from __future__ import annotations

import logging

from app.db import SessionLocal
from app.services import settings_service as ss

from .celery_app import celery

log = logging.getLogger(__name__)


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
