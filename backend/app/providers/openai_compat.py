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
    ProviderQuotaError,
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


def _with_retry(do_request: Callable[[], httpx.Response], max_attempts: int | None = None) -> httpx.Response:
    """Выполнить запрос с повтором на 429/5xx/таймаут. Возвращает последний ответ.

    max_attempts можно занизить (балансир делает быстрый failover на следующую модель).
    """
    attempts = max_attempts or MAX_ATTEMPTS
    for attempt in range(1, attempts + 1):
        try:
            resp = do_request()
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            if attempt >= attempts:
                raise ProviderError(f"Сеть/таймаут после {attempt} попыток: {exc}") from exc
            _sleep_backoff(attempt, None)
            continue
        if resp.status_code in RETRYABLE_STATUS and attempt < attempts:
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
        max_attempts: int | None = None,
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
            ), max_attempts=max_attempts)
            resp.raise_for_status()
            data = resp.json()
            # некоторые OpenAI-совместимые сервера (напр. Ollama Cloud) отдают 200 + {"error": ...}
            if isinstance(data, dict) and data.get("error"):
                err = data["error"]
                msg = err.get("message") if isinstance(err, dict) else str(err)
                if "subscription" in msg.lower() or "quota" in msg.lower() or "limit" in msg.lower():
                    raise ProviderQuotaError(msg)
                raise ProviderError(msg)
            return data["choices"][0]["message"]["content"] or ""
        except httpx.HTTPStatusError as exc:
            code = exc.response.status_code
            text = _http_error_text(exc)
            if code in (402, 429):
                raise ProviderQuotaError(text) from exc  # балансир уйдёт на след. модель
            raise ProviderError(text) from exc
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
            # И сегменты, И слова: без "segment" Groq отдаёт только words без нормальной сегментации.
            "timestamp_granularities[]": ["segment", "word"],
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


def _join_words(words: list[Word]) -> str:
    return " ".join(w.word.strip() for w in words if w.word.strip())


def _parse_transcription(payload: dict, *, provider: str, model: str) -> Transcript:
    language = payload.get("language")
    raw_segments = payload.get("segments") or []
    all_words = [
        Word(word=w.get("word", ""), start=float(w.get("start", 0)), end=float(w.get("end", 0)))
        for w in (payload.get("words") or [])
    ]

    segments: list[TranscriptSegment] = []
    for seg in raw_segments:
        s = float(seg.get("start", 0))
        e = float(seg.get("end", 0))
        seg_words = [
            Word(word=w.get("word", ""), start=float(w.get("start", 0)), end=float(w.get("end", 0)))
            for w in (seg.get("words") or [])
        ]
        # сегмент без своих слов, но есть общий список → берём слова из его диапазона
        if not seg_words and all_words:
            seg_words = [w for w in all_words if w.start >= s - 0.01 and w.end <= e + 0.01]
        text = (seg.get("text") or "").strip() or _join_words(seg_words)
        segments.append(TranscriptSegment(start=s, end=e, text=text, words=seg_words))

    # Совсем нет сегментов (только words) — один сегмент как фолбэк, текст с пробелами.
    if not segments and all_words:
        segments.append(
            TranscriptSegment(
                start=all_words[0].start, end=all_words[-1].end,
                text=_join_words(all_words), words=all_words,
            )
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
        err = body.get("error") if isinstance(body, dict) else None
        if isinstance(err, dict):
            detail = err.get("message") or str(err)
        elif isinstance(err, str):
            detail = err
        elif isinstance(body, dict):
            detail = body.get("detail") or str(body)
        else:
            detail = str(body)
    except ValueError:
        detail = exc.response.text[:300]
    if code in (401, 403):
        return f"Аутентификация не прошла (HTTP {code}): проверьте api_key. {detail}"
    if code == 404:
        return f"Не найдено (HTTP {code}): проверьте base_url/модель. {detail}"
    if code == 429:
        return f"Превышен лимит провайдера (HTTP 429). {detail}"
    return f"HTTP {code}: {detail}"
