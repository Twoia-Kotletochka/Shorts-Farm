"""Шифрование чувствительных значений (API-ключи, пароль панели) для БД.

Используется Fernet; ключ — из настройки FERNET_KEY (см. .env.example).
В ответах API секреты отдаются маскированными (см. mask_secret).
"""
from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings


class CryptoError(RuntimeError):
    pass


def _fernet() -> Fernet:
    key = get_settings().fernet_key
    if not key:
        raise CryptoError(
            "FERNET_KEY не задан. Задай его в .env "
            "(сгенерировать: python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\")."
        )
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError) as exc:  # некорректный ключ
        raise CryptoError(f"FERNET_KEY некорректен: {exc}") from exc


def encrypt(value: str) -> str:
    """Зашифровать строку → текст для хранения в БД."""
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    """Расшифровать значение из БД. Бросает CryptoError при сбое."""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise CryptoError("Не удалось расшифровать значение (сменился FERNET_KEY?).") from exc


def mask_secret(value: str | None) -> str | None:
    """Маскировка секрета для ответов API: показываем только хвост."""
    if not value:
        return value
    if len(value) <= 4:
        return "****"
    return "****" + value[-4:]
