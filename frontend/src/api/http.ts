import axios, { AxiosError } from 'axios'

/** Базовый префикс API. По умолчанию '/api' (Vite-прокси или MSW). */
export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

/** Включён ли mock-режим (MSW). */
export const IS_MOCK = import.meta.env.VITE_API_MOCK === '1'

export const http = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

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

/** Абсолютный URL медиа-эндпоинта (для <video>/<img>/скачивания). */
export function mediaUrl(path: string): string {
  return `${API_BASE}${path}`
}
