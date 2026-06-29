"""Метаданные для ручной публикации (заголовок/описание/хэштеги/первый коммент/варианты).

Генерируем для одобренных финалов (или по запросу), не на все черновики — экономим вызовы.
"""
from __future__ import annotations

import logging

from ..providers import ProviderConfig, ProviderError, build_llm
from . import prompts
from .jsonutil import parse_json

log = logging.getLogger(__name__)


def generate_metadata(
    *,
    hook_title: str,
    category: str | None,
    transcript_text: str,
    llm_config: ProviderConfig,
    language: str,
) -> dict:
    llm = build_llm(llm_config)
    try:
        out = llm.complete(
            [
                {"role": "system", "content": prompts.metadata_system(language)},
                {"role": "user", "content": prompts.metadata_user(hook_title, category, transcript_text)},
            ],
            temperature=0.6,
            max_tokens=800,
            response_format={"type": "json_object"},
        )
        data = parse_json(out)
    except ProviderError as exc:
        log.warning("Метаданные не сгенерированы: %s", exc)
        data = {}

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
