"""Точка входа FastAPI.

Запуск: uvicorn app.main:app (команда задаётся в docker-compose).
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api import api_router
from .bootstrap import init_db
from .logging_config import configure_logging
from .storage import ensure_storage_dirs

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    configure_logging()
    log.info("Shorts Farm API %s — старт", __version__)
    # Создаём недостающие подпапки хранилища при первом запуске.
    ensure_storage_dirs()
    # Схема БД + сид дефолтных категорий и настроек.
    init_db()
    yield
    log.info("Shorts Farm API — остановка")


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(
        title="Shorts Farm API",
        version=__version__,
        description="Self-hosted ферма коротких видео. Контракт — файл 01.",
        lifespan=lifespan,
    )

    # Панель в LAN; CORS открыт для удобства локальной разработки фронта.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api")
    return app


app = create_app()
