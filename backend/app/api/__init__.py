"""Агрегатор REST-роутеров. Монтируется в main под префиксом /api. Контракт — файл 01."""
from __future__ import annotations

from fastapi import APIRouter

from .routes import (
    backup,
    categories,
    dashboard,
    health,
    jobs,
    library,
    profiles,
    settings,
    shorts,
    subtitle_presets,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(library.router)
api_router.include_router(jobs.router)
api_router.include_router(shorts.router)
api_router.include_router(categories.router)
api_router.include_router(subtitle_presets.router)
api_router.include_router(profiles.router)
api_router.include_router(settings.router)
api_router.include_router(dashboard.router)
api_router.include_router(backup.router)
