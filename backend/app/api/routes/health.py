"""Здоровье сервисов: api/redis/worker + статус провайдеров (LLM/STT).

Контракт: GET /api/health → { api, redis, worker, llm_provider, stt_provider }.
Статус провайдеров определяется по конфигурации (без сетевых вызовов) — «ok» / «not_configured».
Полную доступность (с пробным запросом) даёт POST /api/providers/test.
"""
from __future__ import annotations

import logging

import redis as redis_lib
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...config import get_settings
from ...db import get_db
from ...providers import ProviderConfig
from ...providers.factory import REQUIRES_KEY
from ...schemas import HealthOut
from ...services import settings_service as ss

log = logging.getLogger(__name__)
router = APIRouter()


def _check_redis() -> bool:
    try:
        client = redis_lib.from_url(
            get_settings().redis_url, socket_connect_timeout=1, socket_timeout=1
        )
        return bool(client.ping())
    except Exception as exc:  # noqa: BLE001
        log.debug("redis health check failed: %s", exc)
        return False


def _check_worker() -> bool:
    try:
        from worker.celery_app import celery

        return bool(celery.control.ping(timeout=1))
    except Exception as exc:  # noqa: BLE001
        log.debug("worker health check failed: %s", exc)
        return False


def _provider_status(cfg: ProviderConfig) -> str:
    configured = bool(
        cfg.model and cfg.base_url and (cfg.api_key or cfg.type not in REQUIRES_KEY)
    )
    return "ok" if configured else "not_configured"


@router.get("/health", response_model=HealthOut)
def health(db: Session = Depends(get_db)) -> HealthOut:
    return HealthOut(
        api=True,
        redis=_check_redis(),
        worker=_check_worker(),
        llm_provider=_provider_status(ss.get_provider_config(db, "llm")),
        stt_provider=_provider_status(ss.get_provider_config(db, "stt")),
    )
