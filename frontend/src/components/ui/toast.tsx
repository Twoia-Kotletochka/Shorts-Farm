import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: number
  title: string
  description?: string
  variant: ToastVariant
  duration: number
}

// ── Стор без зависимостей (module singleton + useSyncExternalStore) ──
let toasts: ToastItem[] = []
const listeners = new Set<() => void>()
let nextId = 1

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  listeners.forEach((l) => l())
}

export interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

function baseToast(opts: ToastOptions): number {
  const id = nextId++
  const item: ToastItem = {
    id,
    title: opts.title,
    description: opts.description,
    variant: opts.variant ?? 'default',
    duration: opts.duration ?? 4000,
  }
  toasts = [...toasts, item]
  listeners.forEach((l) => l())
  if (item.duration > 0) {
    setTimeout(() => dismissToast(id), item.duration)
  }
  return id
}

/** toast(...) + удобные шорткаты toast.success / error / info / warning. */
export const toast = Object.assign(baseToast, {
  success: (title: string, description?: string) =>
    baseToast({ title, description, variant: 'success' }),
  error: (title: string, description?: string) =>
    baseToast({ title, description, variant: 'error', duration: 6000 }),
  info: (title: string, description?: string) => baseToast({ title, description, variant: 'info' }),
  warning: (title: string, description?: string) =>
    baseToast({ title, description, variant: 'warning' }),
})

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function getSnapshot() {
  return toasts
}

const ICONS = {
  default: Info,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}
const ICON_TONE: Record<ToastVariant, string> = {
  default: 'text-content-muted',
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
}

export function Toaster() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      {items.map((t) => {
        const Icon = ICONS[t.variant]
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border-strong bg-bg-elev p-3.5 shadow-pop animate-slide-in-right"
          >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_TONE[t.variant])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-content">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-content-muted">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="rounded p-0.5 text-content-faint hover:text-content"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
