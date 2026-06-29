"""Фабрика провайдеров: создание LLM/STT из конфига + проверка подключения.

Groq не захардкожен — это один из вариантов. STT и LLM выбираются независимо.
"""
from __future__ import annotations

import logging

from .base import (
    LLMProvider,
    ProviderConfig,
    ProviderError,
    ProviderNotConfigured,
    TranscriptionProvider,
)
from .openai_compat import OpenAICompatLLM, OpenAICompatSTT

log = logging.getLogger(__name__)

# Типы, требующие api_key (у Ollama своего сервера ключ не нужен).
REQUIRES_KEY = {"groq", "openai", "openrouter"}
# Провайдеры с трекаемыми квотами (где есть учёт расхода/ожидание сброса).
QUOTA_PROVIDERS = {"groq"}


def provider_has_limits(provider_type: str) -> bool:
    """Есть ли у провайдера квоты, которые мы учитываем (мягко выключается для безлимитных)."""
    return provider_type in QUOTA_PROVIDERS


def _validate(config: ProviderConfig, kind: str) -> None:
    if not config.model:
        raise ProviderNotConfigured(f"{kind}-провайдер не настроен: не задана модель.")
    if not config.base_url:
        raise ProviderNotConfigured(f"{kind}-провайдер не настроен: не задан base_url.")
    if config.type in REQUIRES_KEY and not config.api_key:
        raise ProviderNotConfigured(
            f"{kind}-провайдер не настроен: не задан api_key для «{config.type}»."
        )


def build_llm(config: ProviderConfig) -> LLMProvider:
    _validate(config, "LLM")
    # Все известные типы OpenAI-совместимы. Anthropic native — отдельный адаптер (на будущее).
    return OpenAICompatLLM(config.base_url, config.api_key, config.model)


def build_stt(config: ProviderConfig) -> TranscriptionProvider:
    _validate(config, "STT")
    # Ollama/OpenRouter — это LLM, не STT; для транскрипции их не берём (валидируется на уровне UI/настроек).
    return OpenAICompatSTT(config.base_url, config.api_key, config.model)


def test_provider(kind: str, config: ProviderConfig) -> tuple[bool, str | None]:
    """Пробный запрос к провайдеру. → (ok, error_text)."""
    try:
        if kind == "llm":
            llm = build_llm(config)
            llm.complete(
                [{"role": "user", "content": "Ответь одним словом: ok"}],
                max_tokens=5,
                temperature=0.0,
            )
        elif kind == "stt":
            stt = build_stt(config)
            # Без аудио проверяем доступность через список моделей (auth + base_url).
            stt.list_models()  # type: ignore[attr-defined]
        else:
            return False, f"Неизвестный тип проверки: {kind}"
        return True, None
    except ProviderError as exc:
        return False, str(exc)
    except Exception as exc:  # noqa: BLE001
        return False, f"Ошибка проверки: {exc}"
