"""Опциональная авторизация по паролю панели (LAN не всегда доверенный).

Если panel_password задан в настройках — все защищённые эндпоинты требуют его
(заголовок X-Panel-Password или query ?panel_key= для медиа в <video>/ссылках).
Если не задан — доступ открыт (поведение по умолчанию). Health и auth — всегда открыты.
"""
from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ...db import get_db
from ...schemas import LoginIn
from ...services import settings_service as ss

router = APIRouter(tags=["auth"])


def require_panel_auth(request: Request, db: Session = Depends(get_db)) -> None:
    """Зависимость защиты эндпоинтов. No-op, если пароль не задан."""
    password = ss.get_panel_password(db)
    if not password:
        return
    provided = request.headers.get("X-Panel-Password") or request.query_params.get("panel_key") or ""
    if not (provided and secrets.compare_digest(provided, password)):
        raise HTTPException(status_code=401, detail="Требуется пароль панели.")


@router.get("/auth/status")
def auth_status(db: Session = Depends(get_db)) -> dict:
    """Нужен ли пароль (для фронта: показывать ли экран входа)."""
    return {"password_required": bool(ss.get_panel_password(db))}


@router.post("/auth/login")
def auth_login(payload: LoginIn, db: Session = Depends(get_db)) -> dict:
    """Проверить пароль панели."""
    password = ss.get_panel_password(db)
    if not password:
        return {"ok": True}
    if payload.password and secrets.compare_digest(payload.password, password):
        return {"ok": True}
    raise HTTPException(status_code=401, detail="Неверный пароль.")
