# Фронтенд Shorts Farm — dev-сервер Vite в контейнере (на хосте Node не нужен).
# Прод-сборка (nginx) добавится позже; для LAN-инструмента dev-сервера достаточно.
FROM node:20-alpine

WORKDIR /app

# Кэшируем установку зависимостей отдельным слоем.
COPY package.json package-lock.json* ./
RUN npm install

# Исходники монтируются volume'ом в dev; COPY на случай standalone-сборки.
COPY . .

EXPOSE 5173
# Генерируем mockServiceWorker.js под установленную версию msw (пишется в bind-mounted public/),
# затем поднимаем dev-сервер. В live-режиме init безвреден.
CMD ["sh", "-c", "npx --yes msw init public --no-save >/dev/null 2>&1 || true; npm run dev -- --host 0.0.0.0 --port ${FRONTEND_PORT:-5173}"]
