"""Анализ транскрипта: два прохода LLM (дешёвая→сильная) + подмешивание сигналов.

Рейтинг считается из ТЕКСТА момента (видео не нужно), с поправкой на аудио-энергию,
плотность склеек и плотность диалога. Возвращает кандидатов (больше, чем нужно — select урежет).
"""
from __future__ import annotations

import json
import logging
from collections.abc import Callable, Iterable

import numpy as np

from ..providers import (
    ProviderConfig, ProviderError, Transcript, TranscriptSegment,
    build_llm, complete_failover,
)
from . import prompts, signals
from .types import RATING_KEYS, Candidate

log = logging.getLogger(__name__)

ProgressCb = Callable[[float, str], None] | None


def _parse_json(text: str) -> dict:
    text = (text or "").strip()
    try:
        return json.loads(text)
    except ValueError:
        # вырезаем самый внешний объект
        i, j = text.find("{"), text.rfind("}")
        if 0 <= i < j:
            try:
                return json.loads(text[i : j + 1])
            except ValueError:
                pass
    return {}


def _text_in_range(segments: list[TranscriptSegment], start: float, end: float) -> str:
    return " ".join(
        s.text for s in segments if s.end >= start and s.start <= end and s.text
    ).strip()


def _batch_segments(segments: list[TranscriptSegment], max_chars: int = 7000) -> list[str]:
    batches: list[str] = []
    buf: list[str] = []
    size = 0
    for s in segments:
        if not s.text:
            continue
        line = f"[{s.start:.1f}-{s.end:.1f}] {s.text}"
        if size + len(line) > max_chars and buf:
            batches.append("\n".join(buf))
            buf, size = [], 0
        buf.append(line)
        size += len(line) + 1
    if buf:
        batches.append("\n".join(buf))
    return batches


def _chunk(seq: list, n: int) -> Iterable[list]:
    for i in range(0, len(seq), n):
        yield seq[i : i + n]


def _dedupe_rough(cands: list[dict], iou: float = 0.5) -> list[dict]:
    """Грубо убрать сильно пересекающиеся кандидаты прохода 1."""
    out: list[dict] = []
    for c in sorted(cands, key=lambda x: x.get("start", 0)):
        s, e = float(c.get("start", 0)), float(c.get("end", 0))
        if e <= s:
            continue
        dup = False
        for o in out:
            os_, oe = o["start"], o["end"]
            inter = max(0.0, min(e, oe) - max(s, os_))
            union = max(e, oe) - min(s, os_)
            if union > 0 and inter / union > iou:
                dup = True
                break
        if not dup:
            out.append({"start": s, "end": e, "category": c.get("category"), "hook": c.get("hook", "")})
    return out


def _candidates_text(group: list[dict], transcript: Transcript) -> str:
    lines = []
    for idx, c in enumerate(group):
        body = _text_in_range(transcript.segments, c["start"], c["end"])
        lines.append(
            f"#{idx} [{c['start']:.1f}-{c['end']:.1f}] категория≈{c.get('category') or '—'}\n{body}"
        )
    return "\n\n".join(lines)


def _blend_signals(
    c: Candidate,
    rms: np.ndarray | None,
    rms_window: float,
    cuts: list[float] | None,
    segments: list[TranscriptSegment],
) -> None:
    """Мягко скорректировать dynamics/overall по дешёвым сигналам."""
    if rms is not None and rms.size:
        energy = signals.energy_in_range(rms, rms_window, c.start, c.end)  # 0..1
        base = float(c.rating.get("dynamics", 0.0) or 0.0)
        c.rating["dynamics"] = 0.7 * base + 0.3 * (energy * 100.0)
        c.rating["overall"] = 0.9 * c.overall + 0.1 * (energy * 100.0)
    if cuts:
        dens = signals.cut_density_in_range(cuts, c.start, c.end)  # склеек/сек
        boost = min(15.0, dens * 30.0)
        c.rating["dynamics"] = min(100.0, float(c.rating.get("dynamics", 0.0)) + boost)
    c.clamp_rating()


def analyze(
    transcript: Transcript,
    *,
    categories: list[dict],
    llm_config: ProviderConfig,
    target_duration: tuple[int, int],
    language: str,
    scene_cuts: list[float] | None = None,
    rms: np.ndarray | None = None,
    rms_window: float = 1.0,
    max_shortlist: int = 40,
    progress_cb: ProgressCb = None,
) -> list[Candidate]:
    llm = build_llm(llm_config)
    fast_models = llm_config.fast_models()    # балансир: дешёвые модели по приоритету
    strong_models = llm_config.strong_models()  # сильные модели по приоритету
    dur_min, dur_max = target_duration

    def progress(p: float, msg: str) -> None:
        if progress_cb:
            progress_cb(p, msg)

    # --- проход 1: широкий список (дешёвая модель) ---
    raw: list[dict] = []
    batches = _batch_segments(transcript.segments)
    for i, batch_text in enumerate(batches):
        progress(0.1 + 0.4 * i / max(len(batches), 1), f"анализ 1/2 ({i + 1}/{len(batches)})")
        try:
            out = complete_failover(
                llm,
                [
                    {"role": "system", "content": prompts.pass1_system(language)},
                    {"role": "user", "content": prompts.pass1_user(batch_text, categories, dur_min, dur_max)},
                ],
                fast_models,
                temperature=0.3,
                max_tokens=1500,
                response_format={"type": "json_object"},
            )
            for c in _parse_json(out).get("candidates", []):
                if "start" in c and "end" in c:
                    raw.append(c)
        except ProviderError as exc:
            log.warning("Проход 1, батч %d: %s", i, exc)

    shortlist = _dedupe_rough(raw)[:max_shortlist]
    log.info("Анализ: проход 1 → %d кандидатов, в шортлист %d.", len(raw), len(shortlist))
    if not shortlist:
        return []

    # --- проход 2: точная оценка (сильная модель) ---
    candidates: list[Candidate] = []
    groups = list(_chunk(shortlist, 8))
    for gi, group in enumerate(groups):
        progress(0.5 + 0.4 * gi / max(len(groups), 1), f"анализ 2/2 ({gi + 1}/{len(groups)})")
        try:
            out = complete_failover(
                llm,
                [
                    {"role": "system", "content": prompts.pass2_system(language)},
                    {"role": "user", "content": prompts.pass2_user(_candidates_text(group, transcript), categories, dur_min, dur_max)},
                ],
                strong_models,
                temperature=0.2,
                max_tokens=2000,
                response_format={"type": "json_object"},
            )
            for clip in _parse_json(out).get("clips", []):
                cand = _to_candidate(clip)
                if cand:
                    candidates.append(cand)
        except ProviderError as exc:
            log.warning("Проход 2, группа %d: %s", gi, exc)

    for c in candidates:
        _blend_signals(c, rms, rms_window, scene_cuts, transcript.segments)

    candidates.sort(key=lambda x: x.overall, reverse=True)
    progress(0.95, f"анализ готов: {len(candidates)} кандидатов")
    return candidates


def _to_candidate(clip: dict) -> Candidate | None:
    try:
        start = float(clip["start"])
        end = float(clip["end"])
    except (KeyError, TypeError, ValueError):
        return None
    if end <= start:
        return None
    rating_in = clip.get("rating", {}) or {}
    rating = {k: float(rating_in.get(k, 0.0) or 0.0) for k in RATING_KEYS}
    if not rating["overall"]:
        others = [rating[k] for k in RATING_KEYS if k != "overall"]
        rating["overall"] = sum(others) / len(others) if others else 0.0
    return Candidate(
        start=start,
        end=end,
        category=clip.get("category"),
        hook_title=clip.get("hook_title", "") or clip.get("hook", ""),
        rating=rating,
        reason=clip.get("reason", ""),
    )
