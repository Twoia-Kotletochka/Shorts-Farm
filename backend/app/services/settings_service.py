"""Чтение/запись настроек с шифрованием секретов (Fernet).

- В БД секреты (api_key провайдеров, пароль панели) хранятся зашифрованными.
- На выдачу (GET /api/settings) секреты маскируются.
- При обновлении: пустое/маскированное значение секрета НЕ затирает существующий ключ
  (фронт присылает маску обратно — её нельзя принять за новый ключ).
"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from ..crypto import CryptoError, decrypt, encrypt, mask_secret
from ..defaults import DEFAULT_SETTINGS
from ..models import Setting
from ..providers import ProviderConfig

log = logging.getLogger(__name__)

PROVIDER_KEYS = ("llm_provider", "stt_provider")


# --- низкоуровневые helpers ---
def _get_raw(db: Session, key: str, default=None):
    row = db.get(Setting, key)
    return row.value_json if row is not None else default


def _set_raw(db: Session, key: str, value) -> None:
    row = db.get(Setting, key)
    if row is None:
        db.add(Setting(key=key, value_json=value))
    else:
        row.value_json = value


def get_value(db: Session, key: str, default=None):
    return _get_raw(db, key, DEFAULT_SETTINGS.get(key, default))


# --- провайдеры ---
def get_provider_config(db: Session, kind: str) -> ProviderConfig:
    """kind = 'llm' | 'stt'. Возвращает конфиг с расшифрованным api_key."""
    key = "llm_provider" if kind == "llm" else "stt_provider"
    raw = dict(_get_raw(db, key) or DEFAULT_SETTINGS[key])
    api_key = _decrypt_safe(raw.get("api_key") or "")
    return ProviderConfig(
        type=raw.get("type", ""),
        base_url=raw.get("base_url"),
        api_key=api_key,
        model=raw.get("model", ""),
        model_fast=raw.get("model_fast"),
        models=raw.get("models") or [],
        models_fast=raw.get("models_fast") or [],
    )


def _decrypt_safe(token: str) -> str:
    if not token:
        return ""
    try:
        return decrypt(token)
    except CryptoError:
        log.warning("Не удалось расшифровать секрет (сменился FERNET_KEY?).")
        return ""


def _mask_provider(raw: dict | None) -> dict:
    raw = dict(raw or {})
    real = _decrypt_safe(raw.get("api_key") or "")
    raw["api_key"] = mask_secret(real) if real else ""
    return raw


# --- выдача (маскированная) ---
def get_settings_masked(db: Session) -> dict:
    out: dict = {}
    for key in DEFAULT_SETTINGS:
        raw = _get_raw(db, key, DEFAULT_SETTINGS[key])
        if key in PROVIDER_KEYS:
            out[key] = _mask_provider(raw)
        elif key == "panel_password":
            out["panel_password_set"] = bool(raw)
        else:
            out[key] = raw
    return out


# --- обновление ---
def update_settings(db: Session, payload: dict) -> None:
    """payload — только изменённые поля (model_dump(exclude_unset=True))."""
    for key, value in payload.items():
        if key in PROVIDER_KEYS:
            if value is not None:
                _update_provider(db, key, value)
        elif key == "panel_password":
            _update_password(db, value)
        elif value is not None:
            _set_raw(db, key, value)
    db.commit()


def _update_provider(db: Session, key: str, value: dict) -> None:
    existing = dict(_get_raw(db, key) or DEFAULT_SETTINGS.get(key, {}))
    merged = dict(existing)
    for field, val in value.items():
        if field == "api_key":
            continue
        merged[field] = val

    incoming = value.get("api_key")
    if not incoming or _looks_masked(incoming):
        merged["api_key"] = existing.get("api_key", "")  # сохранить существующий
    else:
        merged["api_key"] = encrypt(incoming)
    _set_raw(db, key, merged)


def _update_password(db: Session, value) -> None:
    if value is None:
        return  # не трогаем
    if value == "":
        _set_raw(db, "panel_password", None)  # отключить пароль
    elif isinstance(value, str) and _looks_masked(value):
        return
    else:
        _set_raw(db, "panel_password", encrypt(value))


def _looks_masked(value: str) -> bool:
    return isinstance(value, str) and value.startswith("****")


# --- пароль панели (для авторизации) ---
def get_panel_password(db: Session) -> str | None:
    enc = _get_raw(db, "panel_password")
    return _decrypt_safe(enc) if enc else None
