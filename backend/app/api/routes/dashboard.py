"""Дашборд: лимиты/статус провайдеров, диск, статистика.

Реальный учёт расхода квот провайдеров подключается в фазе H; здесь корректная
структура ответа: диск — по-настоящему, расход — заглушка (used=0).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import Short, ShortStatus
from ...providers import ProviderConfig, provider_has_limits
from ...providers.factory import REQUIRES_KEY
from ...schemas import DiskUsage, StatsOut, UsageOut, UsageProvider
from ...services import settings_service as ss
from ...storage import disk_usage_gb

router = APIRouter(tags=["dashboard"])

# Известные суточные лимиты (Groq free tier), сек аудио на модель Whisper.
_GROQ_STT_DAILY_SEC = 28800.0


def _usage_provider(cfg: ProviderConfig, kind: str) -> UsageProvider:
    has_limits = provider_has_limits(cfg.type)
    configured = bool(
        cfg.model and cfg.base_url and (cfg.api_key or cfg.type not in REQUIRES_KEY)
    )
    limit = None
    used = None
    if has_limits:
        used = 0.0  # реальный расход — фаза H
        if kind == "stt" and cfg.type == "groq":
            limit = _GROQ_STT_DAILY_SEC
    return UsageProvider(
        provider=cfg.type or "—",
        has_limits=has_limits,
        used=used,
        limit=limit,
        available=configured,
    )


@router.get("/usage", response_model=UsageOut)
def usage(db: Session = Depends(get_db)) -> UsageOut:
    llm_cfg = ss.get_provider_config(db, "llm")
    stt_cfg = ss.get_provider_config(db, "stt")
    free_gb, total_gb = disk_usage_gb()
    return UsageOut(
        llm=_usage_provider(llm_cfg, "llm"),
        stt=_usage_provider(stt_cfg, "stt"),
        disk=DiskUsage(free_gb=free_gb, total_gb=total_gb),
    )


@router.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db)) -> StatsOut:
    generated = db.scalar(select(func.count(Short.id))) or 0
    approved = (
        db.scalar(select(func.count(Short.id)).where(Short.status == ShortStatus.APPROVED)) or 0
    )
    return StatsOut(generated=generated, approved=approved)
