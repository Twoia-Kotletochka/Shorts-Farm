"""Метаданные для ручной публикации (заголовок/описание/хэштеги/первый коммент/варианты).

Генерируем для одобренных финалов (или по запросу), не на все черновики — экономим вызовы.
"""
from __future__ import annotations

import logging

from ..providers import ProviderConfig, ProviderError, llm_text
from . import prompts
from .jsonutil import parse_json

log = logging.getLogger(__name__)


def _ask(llm_configs, hook_title, category, transcript_text, language, tier: str) -> dict:
    out = llm_text(
        llm_configs,
        [
            {"role": "system", "content": prompts.metadata_system(language)},
            {"role": "user", "content": prompts.metadata_user(hook_title, category, transcript_text)},
        ],
        tier=tier,
        temperature=0.6,
        max_tokens=800,
        response_format={"type": "json_object"},
    )
    data = parse_json(out)
    if not isinstance(data, dict):  # parse_json может вернуть список/скаляр — приводим к {}
        log.warning("Метаданные: неожиданный JSON (%s); первые 200 симв: %r", type(data).__name__, str(out)[:200])
        data = {}
    return data


def _fallback(hook_title: str, category: str | None, transcript_text: str) -> dict:
    """Локальные метаданные, когда LLM недоступен/пуст — поля НИКОГДА не остаются пустыми."""
    desc = transcript_text.strip().replace("\n", " ")
    if len(desc) > 160:
        desc = desc[:157].rsplit(" ", 1)[0] + "…"
    tags = ["#shorts", "#reels", "#fyp"]
    if category:
        tags.insert(0, "#" + str(category).replace(" ", ""))
    return {"title": hook_title or (desc[:60] or "Клип"), "description": desc,
            "hashtags": tags[:15], "first_comment": "", "variants": []}


def generate_metadata(
    *,
    hook_title: str,
    category: str | None,
    transcript_text: str,
    llm_configs: list[ProviderConfig],
    language: str,
) -> dict:
    data: dict = {}
    for tier in ("strong", "fast"):  # не вышло сильной — пробуем дешёвую, потом локальный фолбэк
        try:
            data = _ask(llm_configs, hook_title, category, transcript_text, language, tier)
        except ProviderError as exc:
            log.warning("Метаданные (%s) не сгенерированы: %s", tier, exc)
            data = {}
        if data.get("title") or data.get("description"):
            break

    if not (data.get("title") or data.get("description")):
        return _fallback(hook_title, category, transcript_text)  # никогда не пусто

    hashtags = data.get("hashtags") or []
    if isinstance(hashtags, str):
        hashtags = [h.strip() for h in hashtags.split() if h.strip()]
    return {
        "title": data.get("title", "") or hook_title,
        "description": data.get("description", ""),
        "hashtags": [str(h) for h in hashtags][:15],
        "first_comment": data.get("first_comment", ""),
        "variants": data.get("variants", []) or [],
    }
