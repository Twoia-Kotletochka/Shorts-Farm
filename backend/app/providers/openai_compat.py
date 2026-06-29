"""OpenAI-совместимые клиенты LLM и STT.

Покрывают Groq (по умолчанию), OpenRouter, Ollama, OpenAI — различие только в
base_url / api_key / model. Не-совместимые провайдеры — отдельные адаптеры за теми же
интерфейсами (base.LLMProvider / base.TranscriptionProvider).
"""
from __future__ import annotations

import logging
import random
import time
from collections.abc import Callable

import httpx

from .base import (
    ProviderError,
    Transcript,
    TranscriptSegment,
    Word,
)

log = logging.getLogger(__name__)

DEFAULT_TIMEOUT = httpx.Timeout(connect=10.0, read=300.0, write=60.0, pool=10.0)

# Повтор с backoff на временные ошибки (квоты/перегрузка/сеть) — см. файл 03.
RETRYABLE_STATUS = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 4
BASE_DELAY = 1.5
MAX_DELAY = 30.0


def _auth_headers(api_key: str | None) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}"} if api_key else {}


def _retry_after(resp: httpx.Response) -> float | None:
    raw = resp.headers.get("Retry-After")
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None  # HTTP-дату не парсим — используем backoff


def _sleep_backoff(attempt: int, retry_after: float | None) -> None:
    if retry_after is not None:
        delay = min(retry_after, MAX_DELAY)
    else:
        delay = min(BASE_DELAY * (2 ** (attempt - 1)), MAX_DELAY)
        delay += random.uniform(0, 0.5 * delay)  # джиттер против синхронных повторов
    log.warning("Провайдер вернул временную ошибку — повтор через %.1fс (попытка %d/%d).",
                delay, attempt, MAX_ATTEMPTS)
    time.sleep(delay)


def _with_retry(do_request: Callable[[], httpx.Response]) -> httpx.Response:
    """Выполнить запрос с повтором на 429/5xx/таймаут. Возвращает последний ответ."""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            resp = do_request()
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            if attempt >= MAX_ATTEMPTS:
                raise ProviderError(f"Сеть/таймаут после {attempt} попыток: {exc}") from exc
            _sleep_backoff(attempt, None)
            continue
        if resp.status_code in RETRYABLE_STATUS and attempt < MAX_ATTEMPTS:
            _sleep_backoff(attempt, _retry_after(resp))
            continue
        return resp
    raise ProviderError("Не удалось выполнить запрос к провайдеру.")


class OpenAICompatLLM:
    """Чат-комплишены через {base_url}/chat/completions."""

    def __init__(self, base_url: str | None, api_key: str | None, model: str):
        if not base_url:
            raise ProviderError("Не задан base_url LLM-провайдера.")
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model

    def complete(
        self,
        messages: list[dict],
        model: str | None = None,
        *,
        temperature: float = 0.4,
        max_tokens: int | None = None,
        response_format: dict | None = None,
    ) -> str:
        payload: dict = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        if response_format is not None:
            payload["response_format"] = response_format

        try:
            resp = _with_retry(lambda: httpx.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                headers=_auth_headers(self.api_key),
                timeout=DEFAULT_TIMEOUT,
            ))
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"] or ""
        except httpx.HTTPStatusError as exc:
            raise ProviderError(_http_error_text(exc)) from exc
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise ProviderError(f"Ошибка LLM-запроса: {exc}") from exc

    def list_models(self) -> list[str]:
        return _list_models(self.base_url, self.api_key)


class OpenAICompatSTT:
    """Транскрипция через {base_url}/audio/transcriptions (verbose_json + word-level)."""

    def __init__(self, base_url: str | None, api_key: str | None, model: str):
        if not base_url:
            raise ProviderError("Не задан base_url STT-провайдера.")
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model

    def transcribe(self, audio_path: str, language: str | None = None) -> Transcript:
        data: dict = {
            "model": self.model,
            "response_format": "verbose_json",
            # word-level таймкоды (Groq/OpenAI). Сегментные тоже придут.
            "timestamp_granularities[]": "word",
        }
        if language:
            data["language"] = language

        try:
            # читаем байты один раз — чтобы повторы не упирались в исчерпанный файловый дескриптор
            with open(audio_path, "rb") as fh:
                content = fh.read()
            fname = audio_path.rsplit("/", 1)[-1]
            resp = _with_retry(lambda: httpx.post(
                f"{self.base_url}/audio/transcriptions",
                data=data,
                files={"file": (fname, content, "application/octet-stream")},
                headers=_auth_headers(self.api_key),
                timeout=DEFAULT_TIMEOUT,
            ))
            resp.raise_for_status()
            return _parse_transcription(resp.json(), provider="openai_compat", model=self.model)
        except httpx.HTTPStatusError as exc:
            raise ProviderError(_http_error_text(exc)) from exc
        except (httpx.HTTPError, KeyError, ValueError, OSError) as exc:
            raise ProviderError(f"Ошибка STT-запроса: {exc}") from exc

    def list_models(self) -> list[str]:
        return _list_models(self.base_url, self.api_key)


def _parse_transcription(payload: dict, *, provider: str, model: str) -> Transcript:
    language = payload.get("language")
    raw_segments = payload.get("segments") or []
    raw_words = payload.get("words") or []

    segments: list[TranscriptSegment] = []
    for seg in raw_segments:
        seg_words = [
            Word(word=w.get("word", ""), start=float(w.get("start", 0)), end=float(w.get("end", 0)))
            for w in (seg.get("words") or [])
        ]
        segments.append(
            TranscriptSegment(
                start=float(seg.get("start", 0)),
                end=float(seg.get("end", 0)),
                text=(seg.get("text") or "").strip(),
                words=seg_words,
            )
        )

    # Если сегментов нет, но есть отдельный массив words — собираем один сегмент.
    if not segments and raw_words:
        words = [
            Word(word=w.get("word", ""), start=float(w.get("start", 0)), end=float(w.get("end", 0)))
            for w in raw_words
        ]
        text = "".join(w.word for w in words).strip() or (payload.get("text") or "")
        if words:
            segments.append(
                TranscriptSegment(start=words[0].start, end=words[-1].end, text=text, words=words)
            )

    return Transcript(segments=segments, language=language, provider=provider, model=model)


def _list_models(base_url: str, api_key: str | None) -> list[str]:
    try:
        resp = _with_retry(lambda: httpx.get(
            f"{base_url.rstrip('/')}/models",
            headers=_auth_headers(api_key),
            timeout=httpx.Timeout(15.0),
        ))
        resp.raise_for_status()
        data = resp.json()
        return [m.get("id", "") for m in data.get("data", []) if m.get("id")]
    except httpx.HTTPStatusError as exc:
        raise ProviderError(_http_error_text(exc)) from exc
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise ProviderError(f"Не удалось получить список моделей: {exc}") from exc


def _http_error_text(exc: httpx.HTTPStatusError) -> str:
    code = exc.response.status_code
    try:
        body = exc.response.json()
        detail = body.get("error", {}).get("message") or body.get("detail") or str(body)
    except ValueError:
        detail = exc.response.text[:300]
    if code in (401, 403):
        return f"Аутентификация не прошла (HTTP {code}): проверьте api_key. {detail}"
    if code == 404:
        return f"Не найдено (HTTP {code}): проверьте base_url/модель. {detail}"
    if code == 429:
        return f"Превышен лимит провайдера (HTTP 429). {detail}"
    return f"HTTP {code}: {detail}"
