"""Парсинг JSON из ответа LLM (терпимо к обёрткам/тексту вокруг)."""
from __future__ import annotations

import json


def parse_json(text: str | bytes) -> dict:
    if isinstance(text, (bytes, bytearray)):
        text = text.decode("utf-8", errors="replace")  # защитный пояс от битых байтов
    text = (text or "").strip()
    try:
        return json.loads(text)
    except ValueError:
        i, j = text.find("{"), text.rfind("}")
        if 0 <= i < j:
            try:
                return json.loads(text[i : j + 1])
            except ValueError:
                pass
    return {}
