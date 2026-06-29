"""Агрегатор REST-роутеров. Монтируется в main под префиксом /api. Контракт — файл 01.

Защищённые роутеры требуют пароль панели (если задан). health и auth — всегда открыты.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from .routes import (
    auth,
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
from .routes.auth import require_panel_auth

api_router = APIRouter()

# Открытые эндпоинты (без пароля): живость и сам логин.
api_router.include_router(health.router)
api_router.include_router(auth.router)

# Защищённые паролем панели (если он задан в настройках).
protected = APIRouter(dependencies=[Depends(require_panel_auth)])
protected.include_router(library.router)
protected.include_router(jobs.router)
protected.include_router(shorts.router)
protected.include_router(categories.router)
protected.include_router(subtitle_presets.router)
protected.include_router(profiles.router)
protected.include_router(settings.router)
protected.include_router(dashboard.router)
protected.include_router(backup.router)
api_router.include_router(protected)
