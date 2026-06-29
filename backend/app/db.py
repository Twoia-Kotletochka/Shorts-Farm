"""Подключение к БД (SQLAlchemy 2.0).

SQLite по умолчанию; код пишется с прицелом на лёгкий переезд на PostgreSQL
(через DATABASE_URL). Для SQLite включаем WAL и foreign_keys.
"""
from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    """Базовый класс для всех ORM-моделей."""


def _make_engine() -> Engine:
    url = get_settings().resolved_database_url
    is_sqlite = url.startswith("sqlite")

    connect_args: dict = {}
    if is_sqlite:
        connect_args["check_same_thread"] = False
        # Каталог под файл SQLite должен существовать до первого подключения.
        prefix = "sqlite:///"
        if url.startswith(prefix):
            db_file = Path(url[len(prefix):])
            db_file.parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(
        url,
        connect_args=connect_args,
        pool_pre_ping=True,
        future=True,
    )

    if is_sqlite:

        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_conn, _record):  # noqa: ANN001
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA busy_timeout=5000")
            cur.close()

    return engine


engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Iterator[Session]:
    """FastAPI-зависимость: сессия БД на время запроса."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
