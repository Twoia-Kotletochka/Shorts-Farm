import axios, { AxiosError } from 'axios'

/** Базовый префикс API. По умолчанию '/api' (Vite-прокси или MSW). */
export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

/** Включён ли mock-режим (MSW). */
export const IS_MOCK = import.meta.env.VITE_API_MOCK === '1'

// ─── Пароль панели (опциональная авторизация) ───────────────────────────────
const PANEL_KEY_STORAGE = 'sf_panel_key'

function readStoredKey(): string | null {
  try {
    return sessionStorage.getItem(PANEL_KEY_STORAGE)
  } catch {
    return null
  }
}

let panelKey: string | null = readStoredKey()

export function getPanelKey(): string | null {
  return panelKey
}

export function setPanelKey(key: string | null): void {
  panelKey = key
  try {
    if (key) sessionStorage.setItem(PANEL_KEY_STORAGE, key)
    else sessionStorage.removeItem(PANEL_KEY_STORAGE)
  } catch {
    /* sessionStorage недоступен — держим только в памяти */
  }
}

// Колбэк на 401 (разлогинить + показать экран входа). Регистрируется AuthProvider.
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn
}

export const http = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  if (panelKey) config.headers.set('X-Panel-Password', panelKey)
  return config
})

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err instanceof AxiosError && err.response?.status === 401) {
      // 401 самого логина обрабатывает форма входа — не разлогиниваем по нему.
      if (!(err.config?.url ?? '').includes('/auth/login')) {
        setPanelKey(null)
        onUnauthorized?.()
      }
    }
    return Promise.reject(err)
  },
)

/** Унифицированное извлечение текста ошибки из ответа FastAPI ({ detail }). */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg)
    if (err.message) return err.message
  }
  if (err instanceof Error) return err.message
  return 'Неизвестная ошибка'
}

/**
 * Абсолютный URL медиа-эндпоинта (для <video>/<img>/скачивания) + query:
 *  - переданные параметры (напр. `v: rev` для сброса кэша после ре-рендера);
 *  - `panel_key` автоматически, если задан пароль панели (заголовок к медиа не повесить).
 */
export function mediaUrl(
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams()
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
    }
  }
  if (panelKey) params.set('panel_key', panelKey)
  const qs = params.toString()
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`
}
