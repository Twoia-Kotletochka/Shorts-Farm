/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Базовый префикс API. По умолчанию '/api' (через Vite-прокси или MSW). */
  readonly VITE_API_BASE?: string
  /** '1' → включить mock-слой (MSW) вместо реального бэкенда. */
  readonly VITE_API_MOCK?: string
  /** Цель прокси для /api в dev (используется vite.config). */
  readonly VITE_API_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
