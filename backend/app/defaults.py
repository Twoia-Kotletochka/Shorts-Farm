"""Дефолтные категории и настройки (создаются при первом старте).

Список категорий редактируется в настройках; здесь — стартовый набор (файл 01).
Дефолтные настройки задают рабочую структуру llm_provider/stt_provider и параметры рендера.
"""
from __future__ import annotations

# (name, hint для LLM)
DEFAULT_CATEGORIES: list[tuple[str, str]] = [
    ("Юмор / смешные моменты", "Шутки, панчлайны, комичные ситуации, реакция вызывающая смех."),
    ("Экшен / динамика", "Драки, погони, перестрелки, быстрые динамичные сцены."),
    ("Эмоциональные сцены", "Драма, трогательные и сильные эмоциональные моменты."),
    ("Сюжетные твисты", "Неожиданные повороты, раскрытия, шокирующие развязки."),
    ("Цитаты и панчлайны", "Запоминающиеся реплики, афоризмы, сильные фразы."),
    ("Напряжение / саспенс", "Нагнетание, клиффхэнгеры, тревожная неопределённость."),
    ("Романтика", "Романтические сцены, признания, химия между персонажами."),
    ("«Вау»-моменты", "Визуально эффектные, зрелищные, впечатляющие кадры."),
]

# Дефолты настроек. Секреты (api_key/panel_password) хранятся ЗАШИФРОВАННЫМИ (Fernet);
# здесь — пустые. Структура llm_provider/stt_provider общая под Groq/OpenRouter/Ollama/OpenAI.
#
# Примечание: для двух проходов LLM используем две модели одного провайдера —
#   model       — сильная (точная оценка короткого списка),
#   model_fast  — дешёвая/быстрая (широкий первый проход).
# Это расширение контракта /api/settings (поле model_fast у llm_provider) — синхронизировать с файлом 01.
DEFAULT_SETTINGS: dict[str, object] = {
    "llm_provider": {
        "type": "groq",
        "base_url": "https://api.groq.com/openai/v1",
        "api_key": "",
        "model": "llama-3.3-70b-versatile",
        "model_fast": "llama-3.1-8b-instant",
    },
    "stt_provider": {
        "type": "groq",
        "base_url": "https://api.groq.com/openai/v1",
        "api_key": "",
        "model": "whisper-large-v3-turbo",
    },
    "default_language": "ru",
    "render": {
        "preset": "medium",          # libx264 preset
        "reframe": "smartcrop",      # smartcrop | blurpad
        "duration_range": [15, 45],  # сек
        "trim_silence": True,        # авто-обрезка тишины по краям
        "encoder": "auto",           # auto (VAAPI→libx264) | libx264
    },
    "retention_days": 14,
    "backup": {"enabled": False, "period": "daily"},
    "panel_password": None,          # если задан — хранится зашифрованным
}

# Ключи, у которых внутри есть секреты, требующие шифрования/маскирования.
SECRET_PROVIDER_KEYS = ("llm_provider", "stt_provider")
