"""Smart-crop: определить горизонтальный центр субъекта (лицо) для кадрирования 9:16.

CPU-дёшево: сэмплируем несколько кадров клипа, детектим лица (OpenCV Haar),
берём медиану центра. Без трекинга по кадрам (для v1 достаточно статичного центра).
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


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
