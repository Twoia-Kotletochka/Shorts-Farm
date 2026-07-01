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
    ProviderQuotaError,
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


def complete_failover(
    llm: LLMProvider,
    messages: list[dict],
    models: list[str],
    *,
    max_attempts_per_model: int = 2,
    **kwargs,
) -> str:
    """Балансир: пробуем модели по порядку, на лимите/ошибке — следующая (в т.ч. бесплатная).

    Так распределяем нагрузку по моделям и не зависим от одной (квоты/кредиты/перегрузка).
    """
    errors: list[str] = []
    for model in models:
        if not model:
            continue
        try:
            return llm.complete(messages, model=model, max_attempts=max_attempts_per_model, **kwargs)
        except ProviderQuotaError as exc:
            log.warning("Модель «%s»: лимит/кредиты — переключаюсь на следующую (%s).", model, exc)
            errors.append(f"{model}: лимит")
        except ProviderError as exc:
            log.warning("Модель «%s»: ошибка — переключаюсь (%s).", model, exc)
            errors.append(f"{model}: {exc}")
    detail = " | ".join(errors) if errors else "список моделей пуст"
    raise ProviderError(f"Все модели недоступны — {detail}")


def llm_text(configs: list[ProviderConfig], messages: list[dict], *, tier: str = "strong", **kwargs) -> str:
    """Фейловер по ПРОВАЙДЕРАМ (по приоритету) и внутри — по моделям. tier: 'strong' | 'fast'."""
    errors: list[str] = []
    for cfg in configs:
        try:
            llm = build_llm(cfg)
        except ProviderError as exc:
            errors.append(f"{cfg.type}: {exc}")
            continue
        models = cfg.fast_models() if tier == "fast" else cfg.strong_models()
        try:
            return complete_failover(llm, messages, models, **kwargs)
        except ProviderError as exc:
            log.warning("LLM-провайдер «%s» не справился, следующий по приоритету: %s", cfg.type, exc)
            errors.append(f"{cfg.type}: {exc}")
    raise ProviderError("Все LLM-провайдеры недоступны — " + " | ".join(errors))


def stt_transcribe(configs: list[ProviderConfig], audio_path: str, language: str | None = None):
    """Транскрипция с фейловером по STT-провайдерам (по приоритету)."""
    errors: list[str] = []
    for cfg in configs:
        try:
            return build_stt(cfg).transcribe(audio_path, language=language)
        except ProviderError as exc:
            log.warning("STT-провайдер «%s» не справился, следующий по приоритету: %s", cfg.type, exc)
            errors.append(f"{cfg.type}: {exc}")
    raise ProviderError("Все STT-провайдеры недоступны — " + " | ".join(errors))


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
