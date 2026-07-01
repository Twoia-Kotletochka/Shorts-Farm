"""Парсинг JSON из ответа LLM (терпимо к обёрткам/тексту вокруг)."""
from __future__ import annotations

import json
import re

# reasoning-модели (qwen3, deepseek-r1 и пр.) кладут рассуждение в <think>…</think> перед ответом
_THINK_RE = re.compile(r"<think\b[^>]*>.*?</think>", re.DOTALL | re.IGNORECASE)


def _strip_reasoning(text: str) -> str:
    text = _THINK_RE.sub("", text)              # снять парные <think>…</think>
    if "</think>" in text:                       # незакрытый/сбитый тег — берём хвост после последнего
        text = text.rsplit("</think>", 1)[-1]
    if "<think>" in text:                        # обрезанный на рассуждении ответ (нет закрытия)
        text = text.split("<think>", 1)[0]
    return text.strip()


def parse_json(text: str | bytes) -> dict:
    if isinstance(text, (bytes, bytearray)):
        text = text.decode("utf-8", errors="replace")  # защитный пояс от битых байтов
    text = _strip_reasoning((text or "").strip())
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
