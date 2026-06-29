"""Субтитры: нарезка реплик под клип, мягкий JSON-оверлей (черновик) и ASS (прожиг в финале).

Safe-area: текст держим вне нижней плашки и правого столбца кнопок TikTok/YouTube.
"""
from __future__ import annotations

import logging

from ..providers import Transcript

log = logging.getLogger(__name__)

# safe-area по умолчанию (для 1080x1920)
DEFAULT_MARGIN_L = 60
DEFAULT_MARGIN_R = 150   # правый столбец кнопок
DEFAULT_MARGIN_V = 240   # нижняя плашка

_ALIGN = {"bottom": 2, "center": 5, "top": 8}


def slice_cues(transcript: Transcript, start: float, end: float) -> list[dict]:
    """Реплики клипа, перебазированные к 0 (начало клипа). Слова сохраняются для караоке."""
    cues: list[dict] = []
    for seg in transcript.segments:
        if seg.end < start or seg.start > end or not seg.text:
            continue
        s = max(seg.start, start) - start
        e = min(seg.end, end) - start
        if e <= s:
            continue
        words = [
            {"word": w.word, "start": max(w.start, start) - start, "end": min(w.end, end) - start}
            for w in seg.words
            if w.end >= start and w.start <= end
        ]
        cues.append({"start": round(s, 3), "end": round(e, 3), "text": seg.text.strip(), "words": words})
    return cues


def apply_translation(cues: list[dict], translated: list[str]) -> list[dict]:
    """Заменить текст реплик переводом (слова-таймкоды теряются — караоке отключаем)."""
    out = []
    for cue, text in zip(cues, translated):
        out.append({"start": cue["start"], "end": cue["end"], "text": text, "words": []})
    return out


def build_soft_json(cues: list[dict]) -> list[dict]:
    """Для мягкого оверлея в плеере превью (без прожига)."""
    return [{"start": c["start"], "end": c["end"], "text": c["text"]} for c in cues]


# ===== ASS =====
def _hex_to_ass(color: str | None, default: str = "&H00FFFFFF") -> str:
    if not color or not color.startswith("#") or len(color) != 7:
        return default
    rr, gg, bb = color[1:3], color[3:5], color[5:7]
    return f"&H00{bb}{gg}{rr}".upper()


def _ass_time(t: float) -> str:
    t = max(0.0, t)
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    cs = int(round((t - int(t)) * 100))
    if cs == 100:
        cs = 99
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _escape(text: str) -> str:
    return text.replace("\n", " ").replace("{", "(").replace("}", ")").strip()


def build_ass(cues: list[dict], preset: dict | None, width: int, height: int) -> str:
    """Сгенерировать текст .ass из реплик клипа и пресета оформления."""
    preset = preset if isinstance(preset, dict) else {}
    style_json = preset.get("style_json")
    if not isinstance(style_json, dict):  # битые данные пресета (напр. style_json=true)
        style_json = {}
    safe = style_json.get("safe_area")
    if not isinstance(safe, dict):
        safe = {}

    font = preset.get("font", "DejaVu Sans")
    size = int(preset.get("size", 48))
    primary = _hex_to_ass(preset.get("color"), "&H00FFFFFF")
    outline_c = _hex_to_ass(preset.get("outline"), "&H00000000")
    has_box = bool(preset.get("background"))
    back_c = _hex_to_ass(preset.get("background"), "&H80000000") if has_box else "&H00000000"
    border_style = 3 if has_box else 1
    outline_w = float(style_json.get("outline_width", 2.5))
    shadow = float(style_json.get("shadow", 0.0))
    align = _ALIGN.get(str(preset.get("position", "bottom")), 2)

    ml = int(safe.get("left", DEFAULT_MARGIN_L))
    mr = int(safe.get("right", DEFAULT_MARGIN_R))
    mv = int(safe.get("bottom", DEFAULT_MARGIN_V))

    karaoke = bool(style_json.get("karaoke"))
    secondary = _hex_to_ass(style_json.get("karaoke_base"), "&H00AAAAAA") if karaoke else primary

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "WrapStyle: 0\n"
        "ScaledBorderAndShadow: yes\n"
        f"PlayResX: {width}\nPlayResY: {height}\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{font},{size},{primary},{secondary},{outline_c},{back_c},"
        f"-1,0,0,0,100,100,0,0,{border_style},{outline_w},{shadow},{align},{ml},{mr},{mv},1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    lines = []
    for cue in cues:
        text = _build_text(cue, karaoke)
        lines.append(f"Dialogue: 0,{_ass_time(cue['start'])},{_ass_time(cue['end'])},Default,,0,0,0,,{text}")
    return header + "\n".join(lines) + "\n"


def _build_text(cue: dict, karaoke: bool) -> str:
    words = cue.get("words") or []
    if karaoke and words:
        parts = []
        for w in words:
            dur_cs = max(1, int(round((w["end"] - w["start"]) * 100)))
            parts.append(f"{{\\k{dur_cs}}}{_escape(w['word'])}")
        return "".join(parts).strip()
    return _escape(cue["text"])
