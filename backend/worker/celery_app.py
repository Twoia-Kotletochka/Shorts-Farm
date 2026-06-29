"""Celery-приложение и базовая конфигурация очередей.

Очереди:
  - render   — тяжёлый ffmpeg-рендер (CPU-only, малый concurrency)
  - network  — сетевые стадии (транскрипция/анализ через провайдеров) — быстрее
  - default  — служебные задачи (health, ретеншн, бэкап)

Реальные задачи генерации придут в фазе H; здесь — инфраструктура и health-task.
"""
from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery = Celery(
    "shorts_farm",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery.conf.update(
    task_default_queue="default",
    task_track_started=True,
    task_acks_late=True,                 # задача подтверждается после выполнения — помогает возобновляемости
    worker_prefetch_multiplier=1,        # не выгребать пачку тяжёлых задач разом
    task_reject_on_worker_lost=True,
    broker_connection_retry_on_startup=True,
    result_expires=60 * 60 * 24 * 7,     # неделя
    timezone="UTC",
    # Поддержка приоритета на Redis (PATCH /api/jobs/{id}/priority)
    broker_transport_options={
        "priority_steps": list(range(10)),
        "queue_order_strategy": "priority",
    },
    # файл расписания beat — вне bind-mounted /app (иначе пишет в репозиторий)
    beat_schedule_filename="/tmp/celerybeat-schedule",
    # Периодические задачи (embedded beat: worker запускается с флагом -B)
    beat_schedule={
        "retention-daily": {"task": "maintenance.retention", "schedule": crontab(hour=4, minute=0)},
        "backup-daily": {"task": "maintenance.backup", "schedule": crontab(hour=4, minute=30)},
    },
)

# Задачи (worker.tasks) подхватываются воркером лениво; API шлёт их по имени (send_task),
# не импортируя тяжёлый пайплайн.
celery.autodiscover_tasks(["worker"])


@celery.task(name="health.ping")
def ping() -> str:
    """Проверка живости очереди."""
    return "pong"
