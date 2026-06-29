"""Экспорт/импорт конфигурации одним JSON (настройки/пресеты/профили/категории).

Экспорт маскирует секреты (как и GET /api/settings). Импорт неразрушающий:
- настройки применяются через settings_service (маскированные/пустые секреты не затирают существующие);
- категории/пресеты/профили — upsert по имени.
Полный бэкап с секретами — это дамп БД (см. backup_service), не этот JSON.
"""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Category, Profile, SubtitlePreset
from . import settings_service as ss

log = logging.getLogger(__name__)


def export_config(db: Session) -> dict:
    return {
        "version": 1,
        "settings": ss.get_settings_masked(db),
        "categories": [
            {"name": c.name, "hint": c.hint} for c in db.scalars(select(Category)).all()
        ],
        "subtitle_presets": [
            {
                "name": p.name, "font": p.font, "size": p.size, "color": p.color,
                "outline": p.outline, "background": p.background, "position": p.position,
                "style_json": p.style_json, "language": p.language,
            }
            for p in db.scalars(select(SubtitlePreset)).all()
        ],
        "profiles": [
            {"name": p.name, "params_json": p.params_json}
            for p in db.scalars(select(Profile)).all()
        ],
    }


def _settings_from_export(masked: dict) -> dict:
    """Готовим payload для settings_service.update_settings из маскированных настроек."""
    payload: dict = {}
    for key in ("llm_provider", "stt_provider", "render", "backup"):
        if key in masked and masked[key] is not None:
            payload[key] = masked[key]
    for key in ("default_language", "retention_days"):
        if key in masked and masked[key] is not None:
            payload[key] = masked[key]
    # panel_password в экспорте только как флаг — не трогаем
    return payload


_KNOWN_KEYS = ("settings", "categories", "subtitle_presets", "profiles")


def import_config(db: Session, data: dict) -> dict:
    if not isinstance(data, dict) or not any(k in data for k in _KNOWN_KEYS):
        raise ValueError("Не похоже на экспорт конфигурации Shorts Farm.")
    imported = {"settings": False, "categories": 0, "subtitle_presets": 0, "profiles": 0}

    if isinstance(data.get("settings"), dict):
        ss.update_settings(db, _settings_from_export(data["settings"]))
        imported["settings"] = True

    for cat in data.get("categories", []) or []:
        name = cat.get("name")
        if not name:
            continue
        exists = db.scalar(select(Category).where(Category.name == name))
        if exists:
            exists.hint = cat.get("hint")
        else:
            db.add(Category(name=name, hint=cat.get("hint")))
        imported["categories"] += 1

    for preset in data.get("subtitle_presets", []) or []:
        name = preset.get("name")
        if not name:
            continue
        exists = db.scalar(select(SubtitlePreset).where(SubtitlePreset.name == name))
        target = exists or SubtitlePreset(name=name)
        for field in ("font", "size", "color", "outline", "background", "position", "style_json", "language"):
            if field in preset:
                setattr(target, field, preset[field])
        if not exists:
            db.add(target)
        imported["subtitle_presets"] += 1

    for prof in data.get("profiles", []) or []:
        name = prof.get("name")
        if not name:
            continue
        exists = db.scalar(select(Profile).where(Profile.name == name))
        if exists:
            exists.params_json = prof.get("params_json", {})
        else:
            db.add(Profile(name=name, params_json=prof.get("params_json", {})))
        imported["profiles"] += 1

    db.commit()
    log.info("Импорт конфига: %s", imported)
    return imported
