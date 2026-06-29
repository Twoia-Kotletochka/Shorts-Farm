import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Dev-сервер слушает на всех интерфейсах (LAN), порт берётся из env.
// Прокси /api → backend (внутри docker-сети это http://api:8000), чтобы не упираться в CORS.
// В mock-режиме (VITE_API_MOCK=1) запросы перехватывает MSW в браузере, прокси не нужен.
export default defineConfig(({ mode }) => {
  const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://api:8000'
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
      port: Number(process.env.FRONTEND_PORT) || 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: Number(process.env.FRONTEND_PORT) || 5173,
    },
    build: {
      sourcemap: mode !== 'production',
    },
  }
})
