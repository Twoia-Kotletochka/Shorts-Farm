"""Чтение/запись настроек с шифрованием секретов (Fernet).

- В БД секреты (api_key провайдеров, пароль панели) хранятся зашифрованными.
- На выдачу (GET /api/settings) секреты маскируются.
- При обновлении: пустое/маскированное значение секрета НЕ затирает существующий ключ
  (фронт присылает маску обратно — её нельзя принять за новый ключ).
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.orm import Session

from ..crypto import CryptoError, decrypt, encrypt, mask_secret
from ..defaults import DEFAULT_SETTINGS
from ..models import Setting
from ..providers import ProviderConfig

log = logging.getLogger(__name__)

PROVIDER_KEYS = ("llm_provider", "stt_provider")          # одиночный (совместимость)
PROVIDER_LIST_KEYS = ("llm_providers", "stt_providers")   # приоритетные списки (index 0 = высший)


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
def _raw_to_config(raw: dict) -> ProviderConfig:
    raw = dict(raw or {})
    return ProviderConfig(
        type=raw.get("type", ""),
        base_url=raw.get("base_url"),
        api_key=_decrypt_safe(raw.get("api_key") or ""),
        model=raw.get("model", ""),
        model_fast=raw.get("model_fast"),
        models=raw.get("models") or [],
        models_fast=raw.get("models_fast") or [],
        extra_headers=_decrypt_headers(raw.get("extra_headers")),
    )


def _decrypt_headers(stored: dict | None) -> dict[str, str]:
    """Значения доп. заголовков хранятся зашифрованными (как api_key)."""
    out: dict[str, str] = {}
    for name, enc in (stored or {}).items():
        val = _decrypt_safe(enc or "")
        if name and val:
            out[name] = val
    return out


def get_provider_configs(db: Session, kind: str) -> list[ProviderConfig]:
    """kind = 'llm' | 'stt'. Список конфигов ПО ПРИОРИТЕТУ (index 0 = высший), ключи расшифрованы.

    Берём приоритетный список (llm_providers/stt_providers); если его нет — одиночный provider.
    """
    list_key = f"{kind}_providers"
    raw_list = _get_raw(db, list_key)
    if not raw_list:
        single = _get_raw(db, f"{kind}_provider") or DEFAULT_SETTINGS[f"{kind}_provider"]
        raw_list = [single]
    return [_raw_to_config(p) for p in raw_list if p]


def get_provider_config(db: Session, kind: str) -> ProviderConfig:
    """Основной (высший приоритет) провайдер — для health/usage/providers-test."""
    return get_provider_configs(db, kind)[0]


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
    if raw.get("extra_headers"):
        raw["extra_headers"] = {
            name: (mask_secret(v) if v else "")
            for name, v in _decrypt_headers(raw["extra_headers"]).items()
        }
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
    # приоритетные списки провайдеров (с масками и id)
    for list_key in PROVIDER_LIST_KEYS:
        raw_list = _get_raw(db, list_key)
        if not raw_list:
            single_key = list_key[:-1]  # llm_providers -> llm_provider
            single = _get_raw(db, single_key, DEFAULT_SETTINGS[single_key])
            raw_list = [{**dict(single), "id": "primary"}]
        out[list_key] = [_mask_provider(p) for p in raw_list]
    return out


# --- обновление ---
def update_settings(db: Session, payload: dict) -> None:
    """payload — только изменённые поля (model_dump(exclude_unset=True))."""
    for key, value in payload.items():
        if key in PROVIDER_LIST_KEYS:
            if value is not None:
                _update_provider_list(db, key, value)
        elif key in PROVIDER_KEYS:
            if value is not None:
                _update_provider(db, key, value)
                _sync_single_into_list(db, key)
        elif key == "panel_password":
            _update_password(db, value)
        elif value is not None:
            _set_raw(db, key, value)
    db.commit()


def _update_provider_list(db: Session, list_key: str, providers: list[dict]) -> None:
    """Сохранить приоритетный список провайдеров. Ключи сохраняются по id (маска не затирает)."""
    existing = _get_raw(db, list_key) or []
    by_id = {p.get("id"): p for p in existing if isinstance(p, dict) and p.get("id")}
    out: list[dict] = []
    for p in providers:
        p = dict(p)
        pid = p.get("id") or uuid.uuid4().hex
        p["id"] = pid
        prev = by_id.get(pid, {})
        incoming = p.get("api_key")
        if not incoming or _looks_masked(incoming):
            p["api_key"] = prev.get("api_key", "")  # сохранить прежний ключ
        else:
            p["api_key"] = encrypt(incoming)
        # доп. заголовки: ключ отсутствует в payload → не трогаем прежние; присутствует → мёржим
        if "extra_headers" in p:
            p["extra_headers"] = _merge_secret_headers(prev.get("extra_headers"), p["extra_headers"])
        elif prev.get("extra_headers"):
            p["extra_headers"] = prev["extra_headers"]
        out.append(p)
    _set_raw(db, list_key, out)
    # зеркалим первый в одиночный provider (совместимость health/usage/providers-test)
    single_key = list_key[:-1]
    if out:
        _set_raw(db, single_key, {k: v for k, v in out[0].items() if k != "id"})


def _sync_single_into_list(db: Session, single_key: str) -> None:
    """Правка одиночного provider (легаси-путь) → синхронизировать первый элемент списка."""
    list_key = single_key + "s"
    single = _get_raw(db, single_key) or {}
    lst = _get_raw(db, list_key)
    if not lst:
        _set_raw(db, list_key, [{**dict(single), "id": uuid.uuid4().hex}])
        return
    lst = list(lst)
    first = dict(lst[0]) if isinstance(lst[0], dict) else {}
    lst[0] = {**dict(single), "id": first.get("id") or uuid.uuid4().hex}
    _set_raw(db, list_key, lst)


def _update_provider(db: Session, key: str, value: dict) -> None:
    existing = dict(_get_raw(db, key) or DEFAULT_SETTINGS.get(key, {}))
    merged = dict(existing)
    for field, val in value.items():
        if field in ("api_key", "extra_headers"):
            continue  # секреты — отдельной обработкой ниже
        merged[field] = val

    incoming = value.get("api_key")
    if not incoming or _looks_masked(incoming):
        merged["api_key"] = existing.get("api_key", "")  # сохранить существующий
    else:
        merged["api_key"] = encrypt(incoming)

    if "extra_headers" in value:
        merged["extra_headers"] = _merge_secret_headers(existing.get("extra_headers"), value["extra_headers"])
    _set_raw(db, key, merged)


def _merge_secret_headers(prev: dict | None, incoming: dict | None) -> dict[str, str]:
    """Значения-секреты доп. заголовков: пусто/маска → сохранить прежнее (шифр.), иначе — зашифровать новое."""
    prev = prev or {}
    out: dict[str, str] = {}
    for name, val in (incoming or {}).items():
        if not name:
            continue
        if not val or _looks_masked(val):
            keep = prev.get(name)
            if keep:
                out[name] = keep  # уже зашифровано
        else:
            out[name] = encrypt(val)
    return out


def _update_password(db: Session, value) -> None:
    if value is None:
        return  # не трогаем
    if value == "":
        _set_raw(db, "panel_password", None)  # отключить пароль
    elif isinstance(value, str) and _looks_masked(value):
        return
    else:
        # пароль ходит в HTTP-заголовке X-Panel-Password (latin-1) → только ASCII
        if not str(value).isascii():
            raise ValueError(
                "Пароль панели — только ASCII (латиница, цифры, символы): "
                "ограничение HTTP-заголовков."
            )
        _set_raw(db, "panel_password", encrypt(value))


def _looks_masked(value: str) -> bool:
    return isinstance(value, str) and value.startswith("****")


# --- пароль панели (для авторизации) ---
def get_panel_password(db: Session) -> str | None:
    enc = _get_raw(db, "panel_password")
    return _decrypt_safe(enc) if enc else None
