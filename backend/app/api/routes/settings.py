"""Настройки + проверка подключения провайдеров."""
from __future__ import annotations

from fastapi import APIRouter, Depends
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
    ss.update_settings(db, payload.model_dump(exclude_unset=True))
    return ss.get_settings_masked(db)


@router.post("/providers/test", response_model=ProviderTestOut)
def providers_test(payload: ProviderTestIn, db: Session = Depends(get_db)) -> ProviderTestOut:
    cfg = payload.config
    api_key = cfg.api_key
    # Фронт мог прислать маскированный/пустой ключ — берём сохранённый реальный.
    if not api_key or api_key.startswith("****"):
        api_key = ss.get_provider_config(db, payload.kind).api_key

    config = ProviderConfig(
        type=cfg.type,
        base_url=cfg.base_url,
        api_key=api_key,
        model=cfg.model,
        model_fast=cfg.model_fast,
    )
    ok, error = test_provider(payload.kind, config)
    return ProviderTestOut(ok=ok, error=error)
