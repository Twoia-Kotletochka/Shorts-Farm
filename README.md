# Shorts Farm

Self-hosted «ферма» вертикальных шортсов из фильмов/сериалов для одного пользователя в локальной сети.

Кладёшь фильмы в `sources/` → через веб-панель выбираешь фильм, категории интересных моментов,
субтитры и эффекты → система «просматривает» фильм (STT + LLM через внешние API), находит моменты
и нарезает вертикальные шортсы → готовые ролики появляются списком в панели → отсматриваешь и
**скачиваешь нужные в исходном качестве**. Авто-постинга нет.

- Вся AI-обработка (Whisper + LLM) — через **внешние HTTP-API** (Groq по умолчанию; OpenRouter / Ollama /
  OpenAI — через настройки `{ base_url, api_key, model }`). Сервер модели в своём процессе не крутит.
- Видео (ffmpeg) — локально, **CPU-only** (с попыткой аппаратного VAAPI-энкода и откатом на libx264).

## Стек
FastAPI · Celery + Redis · SQLAlchemy/SQLite (с прицелом на PostgreSQL) · ffmpeg · React/Vite (отдельная сессия).

## Раскладка
```
Shorts-Farm/
  docker-compose.yml        # api, worker, redis (frontend добавится позже)
  .env.example
  backend/
    Dockerfile  requirements.txt
    app/        # FastAPI: config, db, storage, crypto, api/, models/, schemas/, providers/, services/
    worker/     # Celery
```
Данные — вне репозитория, в `/srv/storage/shorts-farm` (см. `STORAGE_PATH_HOST`).

## Развёртывание на сервере

Проект целиком живёт и проверяется на сервере `raptor@192.168.0.92` в `/srv/Shorts-Farm`.

**Разовая подготовка (с sudo):**
```bash
sudo mkdir -p /srv/Shorts-Farm /srv/storage/shorts-farm
sudo chown raptor:raptor /srv/Shorts-Farm /srv/storage/shorts-farm
```

**Запуск:**
```bash
cd /srv/Shorts-Farm
cp .env.example .env
# заполнить FERNET_KEY:
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# (вписать в .env), при необходимости поправить API_BIND_HOST
docker compose up -d --build
```

Проверка:
```bash
curl http://192.168.0.92:8000/api/health     # { api, redis, worker, llm_provider, stt_provider }
docker compose logs -f worker
```

## Сеть и безопасность
- API публикуется на интерфейс из `API_BIND_HOST` (LAN-IP сервера) — **панель не наружу**.
- Опциональный пароль на панель — в настройках (фаза C/D).
- Секреты (ключи провайдеров, пароль) шифруются в БД (Fernet), ключ — в `.env`.

## Статус
Бэкенд строится по фазам (см. задачи): **A** каркас → **B** БД → **C** провайдеры → **D** API →
**E** аудио/транскрипция → **F** анализ → **G** рендер → **H** оркестрация.
