"""Настройки + проверка подключения провайдеров."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...db import get_db
from ...providers import ProviderConfig, test_provider
from ...schemas import ProviderTestIn, ProviderTestOut, SettingsUpdate
from ...services import settings_service as ss

router = APIRouter(tags=["settings"])


@router.get("/settings")
def get_settings_route(db: Session = Depends(get_db)) -> dict:
    return ss.get_settings_masked(db)


@router.put("/settings")
def put_settings_route(payload: SettingsUpdate, db: Session = Depends(get_db)) -> dict:
    try:
        ss.update_settings(db, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ss.get_settings_masked(db)


@router.post("/providers/test", response_model=ProviderTestOut)
def providers_test(payload: ProviderTestIn, db: Session = Depends(get_db)) -> ProviderTestOut:
    cfg = payload.config
    # Секреты (api_key + extra_headers) фронт присылает маскированными — подставляем
    # сохранённые ИМЕННО у тестируемого провайдера (по id), а не у первого.
    saved = ss.get_provider_config_by_id(db, payload.kind, cfg.id) \
        or ss.get_provider_config(db, payload.kind)

    api_key = cfg.api_key
    if not api_key or api_key.startswith("****"):
        api_key = saved.api_key

    # Доп. заголовки: ключ не прислан → сохранённые целиком; маска/пусто → прежнее по имени.
    if cfg.extra_headers is None:
        headers = dict(saved.extra_headers or {})
    else:
        headers = {
            name: (
                (saved.extra_headers or {}).get(name, "")
                if (not val or val.startswith("****"))
                else val
            )
            for name, val in cfg.extra_headers.items()
        }

    config = ProviderConfig(
        type=cfg.type,
        base_url=cfg.base_url,
        api_key=api_key,
        model=cfg.model,
        model_fast=cfg.model_fast,
        extra_headers=headers or None,
    )
    ok, error = test_provider(payload.kind, config)
    return ProviderTestOut(ok=ok, error=error)
