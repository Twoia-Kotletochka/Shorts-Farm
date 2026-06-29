"""Промпты пайплайна — в одном месте, параметризованы (категории, длительность, язык).

`analyze` — главный рычаг качества: дорабатывается итеративно на реальных фильмах.
Требуем: клип самодостаточен, сильный крючок в первые 1–3 сек, законченная мысль,
длительность в целевом диапазоне.
"""
from __future__ import annotations

import json


def _categories_block(categories: list[dict]) -> str:
    if not categories:
        return "(категории не заданы — оценивай общий интерес момента)"
    lines = []
    for c in categories:
        name = c.get("name", "")
        hint = c.get("hint")
        lines.append(f"- {name}" + (f": {hint}" if hint else ""))
    return "\n".join(lines)


# ===== Проход 1 — широкий список кандидатов (дешёвая модель) =====
def pass1_system(language: str) -> str:
    return (
        "Ты — редактор коротких вертикальных видео (Shorts/Reels/TikTok). "
        "Тебе дают фрагмент транскрипта фильма/сериала с таймкодами в секундах. "
        "Твоя задача — найти моменты, которые сработают как самостоятельный вирусный клип.\n"
        "Требования к моменту:\n"
        "• самодостаточен — понятен без контекста всего фильма;\n"
        "• сильный крючок в первые 1–3 секунды;\n"
        "• законченная мысль или сцена;\n"
        "• подходит под одну из заданных категорий.\n"
        f"Заголовки (hook) пиши на языке: {language}. "
        "Не выдумывай таймкоды — бери из транскрипта. Отвечай строго JSON."
    )


def pass1_user(segments_text: str, categories: list[dict], dur_min: int, dur_max: int) -> str:
    return (
        f"Категории интереса:\n{_categories_block(categories)}\n\n"
        f"Целевая длительность клипа: {dur_min}–{dur_max} секунд.\n\n"
        "Транскрипт (таймкоды в секундах):\n"
        f"{segments_text}\n\n"
        'Верни JSON вида: {"candidates": [{"start": <сек>, "end": <сек>, '
        '"category": "<одна из категорий>", "hook": "<короткий крючок>"}]}. '
        "Только сильные кандидаты (можно ноль, если ничего нет). Без пояснений вне JSON."
    )


# ===== Проход 2 — точная оценка короткого списка (сильная модель) =====
def pass2_system(language: str) -> str:
    return (
        "Ты — строгий редактор вирусных вертикальных клипов. "
        "Тебе дают кандидатов (таймкоды + текст). Оцени каждого по шкале 0–100 по критериям:\n"
        "• retention — удержание (держит ли внимание до конца);\n"
        "• emotion — эмоциональный отклик;\n"
        "• dynamics — динамика/энергия;\n"
        "• virality — вирусный потенциал;\n"
        "• overall — общая оценка.\n"
        f"hook_title и reason пиши на языке: {language}. "
        "reason — кратко, почему момент сильный. Отвечай строго JSON."
    )


def pass2_user(candidates_text: str, categories: list[dict], dur_min: int, dur_max: int) -> str:
    return (
        f"Категории: {', '.join(c.get('name', '') for c in categories) or '—'}.\n"
        f"Целевая длительность: {dur_min}–{dur_max} сек (подгони start/end к завершённой мысли).\n\n"
        f"Кандидаты:\n{candidates_text}\n\n"
        'Верни JSON: {"clips": [{"start": <сек>, "end": <сек>, "category": "<категория>", '
        '"hook_title": "<заголовок>", "reason": "<почему выбран>", '
        '"rating": {"overall": <0-100>, "retention": <0-100>, "emotion": <0-100>, '
        '"dynamics": <0-100>, "virality": <0-100>}}]}. Без текста вне JSON.'
    )


# ===== Метаданные (фаза 3b) =====
def metadata_system(language: str) -> str:
    return (
        "Ты — SMM-редактор. По описанию клипа сгенерируй метаданные для ручной публикации "
        f"на языке: {language}. Отвечай строго JSON."
    )


def metadata_user(hook_title: str, category: str | None, transcript_text: str) -> str:
    return (
        f"Категория: {category or '—'}\nЗаголовок-крючок: {hook_title}\n"
        f"Реплики клипа:\n{transcript_text[:2000]}\n\n"
        'Верни JSON: {"title": "<цепляющий заголовок>", "description": "<2-3 предложения>", '
        '"hashtags": ["#...", "..."], "first_comment": "<вовлекающий первый коммент>", '
        '"variants": [{"label": "короткий", "title": "..."}, {"label": "длинный", "title": "..."}]}.'
    )


# ===== Перевод субтитров (фаза G) =====
def translate_system(target_language: str) -> str:
    return (
        f"Переводчик субтитров. Переводи реплики на язык: {target_language}. "
        "Сохраняй смысл и краткость (это субтитры). Отвечай строго JSON-массивом строк "
        "той же длины и порядка, что и вход."
    )


def translate_user(lines: list[str]) -> str:
    return (
        "Переведи строки, сохранив порядок. Верни JSON: "
        '{"lines": [<перевод каждой строки>]}.\n\n'
        f"Строки:\n{json.dumps(lines, ensure_ascii=False)}"
    )
