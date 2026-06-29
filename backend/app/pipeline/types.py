"""Общие типы пайплайна анализа/отбора."""
from __future__ import annotations

from dataclasses import dataclass, field

RATING_KEYS = ("overall", "retention", "emotion", "dynamics", "virality")


@dataclass
class Candidate:
    start: float
    end: float
    category: str | None = None
    hook_title: str = ""
    rating: dict = field(default_factory=dict)  # ключи RATING_KEYS, шкала 0..100
    reason: str = ""
    moment_id: str | None = None

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)

    @property
    def overall(self) -> float:
        return float(self.rating.get("overall", 0.0) or 0.0)

    def clamp_rating(self) -> None:
        for k in RATING_KEYS:
            v = float(self.rating.get(k, 0.0) or 0.0)
            self.rating[k] = max(0.0, min(100.0, v))
