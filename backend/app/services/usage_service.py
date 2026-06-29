"""Учёт расхода квоты STT (аудио-секунды/сутки). Включается только для провайдеров с квотами.

Хранится в settings (ключ usage_stt) как {date, seconds}; счётчик сбрасывается на новой дате.
"""
from __future__ import annotations

import datetime as dt
import logging

from sqlalchemy.orm import Session

from ..models import Setting

log = logging.getLogger(__name__)

_KEY = "usage_stt"
GROQ_DAILY_SEC = 28800.0  # на модель Whisper (free tier)


def _today() -> str:
    # квоты провайдеров сбрасываются по UTC — считаем по UTC-дате
    return dt.datetime.now(dt.timezone.utc).date().isoformat()


def _get(db: Session) -> dict:
    row = db.get(Setting, _KEY)
    data = row.value_json if row and isinstance(row.value_json, dict) else {}
    if data.get("date") != _today():
        return {"date": _today(), "seconds": 0.0}
    return data


def get_today_seconds(db: Session) -> float:
    return float(_get(db).get("seconds", 0.0))


def record_seconds(db: Session, seconds: float) -> None:
    if not seconds or seconds <= 0:
        return
    data = _get(db)
    data["seconds"] = float(data.get("seconds", 0.0)) + float(seconds)
    row = db.get(Setting, _KEY)
    if row is None:
        db.add(Setting(key=_KEY, value_json=data))
    else:
        row.value_json = data
    db.commit()


def remaining_seconds(db: Session, daily_limit: float = GROQ_DAILY_SEC) -> float:
    return max(0.0, daily_limit - get_today_seconds(db))
