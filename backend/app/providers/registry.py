"""Точки расширения: реестры видеоэффектов, алгоритмов поиска сцен и экспортеров.

Чистые интерфейсы + реестр, БЕЗ динамической подгрузки плагинов (переинженеринг для v1).
Конкретные эффекты/детекторы регистрируются в фазах F/G. `Exporter` — точка расширения на
будущее (Telegram/платформы); сейчас готовый ролик отдаётся скачиванием с панели.
"""
from __future__ import annotations

from typing import Generic, Protocol, TypeVar, runtime_checkable

T = TypeVar("T")


class Registry(Generic[T]):
    def __init__(self, kind: str):
        self.kind = kind
        self._items: dict[str, T] = {}

    def register(self, name: str):
        def deco(obj: T) -> T:
            self._items[name] = obj
            return obj

        return deco

    def add(self, name: str, obj: T) -> None:
        self._items[name] = obj

    def get(self, name: str) -> T:
        if name not in self._items:
            raise KeyError(f"{self.kind} «{name}» не зарегистрирован. Доступны: {self.names()}")
        return self._items[name]

    def names(self) -> list[str]:
        return list(self._items)


@runtime_checkable
class Exporter(Protocol):
    """Куда отдаём готовый ролик. Сейчас не используется (скачивание с панели)."""

    def export(self, short_id: int, file_path: str) -> None: ...


# Реестры (наполняются в соответствующих фазах)
effects: Registry = Registry("video-effect")
scene_detectors: Registry = Registry("scene-detector")
exporters: Registry[Exporter] = Registry("exporter")
