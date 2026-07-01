"""Перевод реплик клипа через LLM (только реплики клипа, не весь фильм)."""
from __future__ import annotations

import logging

from ..providers import ProviderConfig, ProviderError, llm_text
from . import prompts
from .jsonutil import parse_json

log = logging.getLogger(__name__)


def translate_lines(lines: list[str], llm_configs: list[ProviderConfig], target_language: str) -> list[str]:
    if not lines:
        return lines
    try:
        out = llm_text(
            llm_configs,
            [
                {"role": "system", "content": prompts.translate_system(target_language)},
                {"role": "user", "content": prompts.translate_user(lines)},
            ],
            tier="fast",
            temperature=0.2,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )
        result = parse_json(out).get("lines")
        if isinstance(result, list) and len(result) == len(lines):
            return [str(x) for x in result]
        log.warning("Перевод вернул несовпадающее число строк — оставляю оригинал.")
    except ProviderError as exc:
        log.warning("Перевод не выполнен: %s", exc)
    return lines
