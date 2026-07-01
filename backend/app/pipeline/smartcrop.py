"""Smart-crop: следить за лицом субъекта для кадрирования 9:16.

face_track: сэмплируем кадры по времени, детектим лицо (OpenCV Haar), строим сглаженную
траекторию центра X(t) — «камера» панорамирует за лицом. face_center_norm — статичный центр (fallback).
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)

MAX_STEP = 0.60   # макс. сдвиг центра между соседними keyframe (выше → камера резче доводит до цели)
DEADZONE = 0.10   # «мёртвая зона»: пока лицо в ±DEADZONE от текущего центра — камера покоится (нет дрейфа)


def face_center_norm(video_path: str, start: float, end: float, samples: int = 8) -> float | None:
    """→ нормализованный X центра лица (0..1) или None, если лиц не найдено."""
    try:
        import cv2
        import numpy as np
    except ImportError:
        log.warning("opencv недоступен — smart-crop по центру.")
        return None

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None
    try:
        cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        centers: list[float] = []
        span = max(end - start, 0.0)
        for i in range(max(samples, 1)):
            t = start + span * (i / max(samples - 1, 1))
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
            ok, frame = cap.read()
            if not ok or frame is None:
                continue
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(40, 40))
            if len(faces):
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                centers.append((x + w / 2.0) / frame.shape[1])
        if not centers:
            return None
        return float(np.median(centers))
    finally:
        cap.release()


def face_track(
    video_path: str, start: float, end: float, *, step_sec: float = 0.6, max_kf: int = 60,
    deadzone: float = DEADZONE, max_step: float = MAX_STEP,
) -> list[tuple[float, float]] | None:
    """Траектория центра лица: [(t_отн_клипа, cx_норм), ...] для динамического кропа.

    Сэмплируем часто (~step_sec), заполняем пропуски. «Камера» покоится, пока лицо в мёртвой
    зоне ±deadzone; вышло — быстро доводим до цели шагом ≤max_step (резко, без вялого дрейфа).
    None — если лиц нет вообще (тогда вызывающий код берёт статичный центр).
    """
    try:
        import cv2
    except ImportError:
        return None

    dur = max(0.1, end - start)
    n = max(2, min(max_kf, int(dur / step_sec) + 1))
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None
    try:
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        ts: list[float] = []
        xs: list[float | None] = []
        any_face = False
        for i in range(n):
            t_rel = dur * i / (n - 1)
            cap.set(cv2.CAP_PROP_POS_MSEC, (start + t_rel) * 1000.0)
            ok, frame = cap.read()
            cx: float | None = None
            if ok and frame is not None:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(40, 40))
                if len(faces):
                    x, _y, w, _h = max(faces, key=lambda f: f[2] * f[3])
                    cx = (x + w / 2.0) / frame.shape[1]
                    any_face = True
            ts.append(round(t_rel, 3))
            xs.append(cx)
        if not any_face:
            return None

        # заполнить пропуски (вперёд, затем назад), остаток — центр
        last = None
        for i in range(len(xs)):
            if xs[i] is None:
                xs[i] = last
            else:
                last = xs[i]
        last = None
        for i in range(len(xs) - 1, -1, -1):
            if xs[i] is None:
                xs[i] = last
            else:
                last = xs[i]
        xs = [0.5 if v is None else v for v in xs]

        # мёртвая зона + быстрый доводчик: камера стоит, пока лицо не вышло за ±deadzone,
        # затем резко (шагом ≤max_step) доводит центр до цели. Так «оператор» не тормозит.
        held = xs[0]
        out = [held]
        for raw in xs[1:]:
            if abs(raw - held) > deadzone:
                step = max(-max_step, min(max_step, raw - held))
                held = held + step
            out.append(held)

        return [(ts[i], round(out[i], 4)) for i in range(len(ts))]
    finally:
        cap.release()
