"""Работа с файловым хранилищем.

Базовый путь — из настроек (STORAGE_PATH). При старте создаём недостающие
подпапки. Все пути к данным строятся через эти хелперы, не хардкодом.
"""
from __future__ import annotations

import logging
import shutil
from pathlib import Path

from .config import get_settings

log = logging.getLogger(__name__)

# Подпапки хранилища (см. файл 01 спецификации)
SUBDIRS: tuple[str, ...] = (
    "sources",            # исходники (кладутся вручную)
    "shorts",             # готовые шортсы
    "cache/audio",        # извлечённое аудио
    "cache/transcripts",  # кэш транскриптов
    "thumbnails",         # превью
    "backups",            # бэкапы БД/конфига
    "db",                 # файл SQLite
)


def storage_root() -> Path:
    return get_settings().storage_path


def storage_path(*parts: str) -> Path:
    return storage_root().joinpath(*parts)


def sources_dir() -> Path:
    return storage_path("sources")


def shorts_dir() -> Path:
    return storage_path("shorts")


def audio_cache_dir() -> Path:
    return storage_path("cache", "audio")


def transcripts_cache_dir() -> Path:
    return storage_path("cache", "transcripts")


def thumbnails_dir() -> Path:
    return storage_path("thumbnails")


def backups_dir() -> Path:
    return storage_path("backups")


def ensure_storage_dirs() -> None:
    """Создать недостающие подпапки хранилища (идемпотентно)."""
    root = storage_root()
    for sub in SUBDIRS:
        path = root / sub
        try:
            path.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            log.error("Не удалось создать подпапку хранилища %s: %s", path, exc)
            raise
    log.info("Хранилище готово: %s", root)


def disk_usage_gb() -> tuple[float, float]:
    """(свободно_ГБ, всего_ГБ) на разделе хранилища."""
    usage = shutil.disk_usage(storage_root())
    gb = 1024 ** 3
    return round(usage.free / gb, 1), round(usage.total / gb, 1)
