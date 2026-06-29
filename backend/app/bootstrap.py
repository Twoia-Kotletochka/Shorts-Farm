"""Инициализация БД при старте: схема + сид категорий и настроек.

Для v1 (SQLite, один пользователь) используем create_all — просто и надёжно.
Alembic подключим при переезде на PostgreSQL (модели уже на SQLAlchemy 2.0).
"""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine
from .defaults import DEFAULT_CATEGORIES, DEFAULT_SETTINGS

log = logging.getLogger(__name__)


def init_db() -> None:
    # Импорт моделей регистрирует таблицы в Base.metadata.
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        _seed_categories(db)
        _seed_settings(db)
        db.commit()
    log.info("БД инициализирована (схема + дефолты).")


def _seed_categories(db: Session) -> None:
    from .models import Category

    existing = db.scalar(select(Category).limit(1))
    if existing is not None:
        return
    for name, hint in DEFAULT_CATEGORIES:
        db.add(Category(name=name, hint=hint))
    log.info("Засеяно %d дефолтных категорий.", len(DEFAULT_CATEGORIES))


def _seed_settings(db: Session) -> None:
    from .models import Setting

    for key, value in DEFAULT_SETTINGS.items():
        present = db.get(Setting, key)
        if present is None:
            db.add(Setting(key=key, value_json=value))
