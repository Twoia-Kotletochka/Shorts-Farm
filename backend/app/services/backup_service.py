"""Бэкап БД и настроек в /srv/storage/backups (дата в имени, ротация).

Бэкапим только невосстановимое: БД (SQLite) + конфиг. Медиа/исходники не бэкапим.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
from pathlib import Path

from sqlalchemy.orm import Session

from ..config import get_settings
from ..storage import backups_dir
from .config_service import export_config

log = logging.getLogger(__name__)

KEEP = 10  # сколько последних дампов держим


def _timestamp() -> str:
    return dt.datetime.now().strftime("%Y%m%d-%H%M%S")


def _sqlite_path() -> Path | None:
    url = get_settings().resolved_database_url
    prefix = "sqlite:///"
    if url.startswith(prefix):
        return Path(url[len(prefix):])
    return None


def make_backup(db: Session) -> str:
    backups = backups_dir()
    backups.mkdir(parents=True, exist_ok=True)
    ts = _timestamp()
    primary = None

    src = _sqlite_path()
    if src and src.exists():
        dst = backups / f"db-{ts}.sqlite"
        # Безопасный онлайн-бэкап SQLite (учитывает WAL).
        with sqlite3.connect(str(src)) as s, sqlite3.connect(str(dst)) as d:
            s.backup(d)
        primary = dst.name
        log.info("Дамп БД: %s", dst)

    # Конфиг (маскированные настройки + пресеты/профили/категории)
    cfg_path = backups / f"config-{ts}.json"
    cfg_path.write_text(json.dumps(export_config(db), ensure_ascii=False, indent=2), encoding="utf-8")
    if primary is None:
        primary = cfg_path.name

    _rotate(backups, "db-", ".sqlite")
    _rotate(backups, "config-", ".json")
    return primary


def _rotate(backups: Path, prefix: str, suffix: str) -> None:
    files = sorted(
        (p for p in backups.glob(f"{prefix}*{suffix}")),
        key=lambda p: p.name,
        reverse=True,
    )
    for old in files[KEEP:]:
        try:
            old.unlink()
        except OSError as exc:
            log.warning("Не удалось удалить старый бэкап %s: %s", old, exc)
