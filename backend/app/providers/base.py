"""Интерфейсы провайдеров AI и общие типы.

Провайдер = конфиг { type, base_url, api_key, model } из настроек; создаётся фабрикой.
Большинство LLM/STT — OpenAI-совместимые (один клиент, разный base_url). Не-совместимые
(напр. Anthropic native) — отдельный адаптер за тем же интерфейсом.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


class ProviderError(RuntimeError):
    """Любая ошибка провайдера (сеть/аутентификация/ответ)."""


class ProviderNotConfigured(ProviderError):
    """Провайдер не настроен (нет ключа/модели/URL) — фронт ведёт в Настройки."""


@dataclass(frozen=True)
class ProviderConfig:
    type: str
    base_url: str | None
    api_key: str | None
    model: str
    model_fast: str | None = None  # дешёвая модель для первого прохода LLM (см. defaults.py)


# --- транскрипт ---
@dataclass
class Word:
    word: str
    start: float
    end: float


@dataclass
class TranscriptSegment:
    start: float
    end: float
    text: str
    words: list[Word] = field(default_factory=list)


@dataclass
class Transcript:
    segments: list[TranscriptSegment]
    language: str | None = None
    provider: str = ""
    model: str = ""

    def to_json(self) -> list[dict]:
        return [
            {
                "start": s.start,
                "end": s.end,
                "text": s.text,
                "words": [{"word": w.word, "start": w.start, "end": w.end} for w in s.words],
            }
            for s in self.segments
        ]

    @property
    def full_text(self) -> str:
        return " ".join(s.text.strip() for s in self.segments).strip()


@runtime_checkable
class LLMProvider(Protocol):
    def complete(
        self,
        messages: list[dict],
        model: str | None = None,
        *,
        temperature: float = 0.4,
        max_tokens: int | None = None,
        response_format: dict | None = None,
    ) -> str: ...


@runtime_checkable
class TranscriptionProvider(Protocol):
    def transcribe(self, audio_path: str, language: str | None = None) -> Transcript: ...
