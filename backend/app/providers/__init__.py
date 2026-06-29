"""Провайдер-абстракция: интерфейсы, OpenAI-совместимые клиенты, фабрика, реестры."""
from __future__ import annotations

from .base import (
    LLMProvider,
    ProviderConfig,
    ProviderError,
    ProviderNotConfigured,
    ProviderQuotaError,
    Transcript,
    TranscriptionProvider,
    TranscriptSegment,
    Word,
)
from .factory import build_llm, build_stt, complete_failover, provider_has_limits, test_provider
from .registry import Exporter, effects, exporters, scene_detectors

__all__ = [
    "LLMProvider",
    "TranscriptionProvider",
    "ProviderConfig",
    "ProviderError",
    "ProviderNotConfigured",
    "ProviderQuotaError",
    "Transcript",
    "TranscriptSegment",
    "Word",
    "build_llm",
    "build_stt",
    "complete_failover",
    "test_provider",
    "provider_has_limits",
    "Exporter",
    "effects",
    "scene_detectors",
    "exporters",
]
