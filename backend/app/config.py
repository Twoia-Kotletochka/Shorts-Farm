"""Конфигурация приложения (из переменных окружения / .env).

Базовый путь хранилища и прочие параметры НЕ хардкодятся по коду —
берутся отсюда. Секреты провайдеров и пароль панели живут в БД
(зашифрованы Fernet), а не здесь.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Окружение
    app_env: str = "production"
    debug: bool = False

    # Хранилище (путь внутри контейнера)
    storage_path: Path = Path("/srv/storage")

    # БД. Пусто => вычисляется из storage_path (SQLite). Структура — под переезд на PostgreSQL.
    database_url: str = ""

    # Очередь
    redis_url: str = "redis://redis:6379/0"

    # Ключ шифрования секретов в БД (Fernet). Обязателен для работы с провайдерами/паролем.
    fernet_key: str = ""

    # Сеть (для справки/документации; фактическую привязку делает docker-compose)
    api_bind_host: str = "127.0.0.1"
    api_port: int = 8000

    # Параллелизм рендер-воркера (CPU-only: 1–2)
    worker_concurrency: int = 2

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"sqlite:///{self.storage_path}/db/shorts_farm.db"


@lru_cache
def get_settings() -> Settings:
    return Settings()
