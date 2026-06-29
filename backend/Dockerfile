FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Системные зависимости:
#  - ffmpeg: нарезка/рендер/энкод (+ VAAPI через libva/mesa/i965; ML-апскейла нет, CPU-only)
#  - шрифты: для прожига субтитров через libass
#  - libgl1/libglib2.0-0: для opencv-python-headless (smart-crop)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      libva2 libva-drm2 vainfo mesa-va-drivers i965-va-driver \
      fonts-dejavu-core fonts-liberation \
      libgl1 libglib2.0-0 \
      curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Код монтируется как volume в dev (см. docker-compose). COPY — для standalone-сборки.
COPY . .

EXPOSE 8000

# Команда задаётся в docker-compose (uvicorn для api, celery для worker).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
