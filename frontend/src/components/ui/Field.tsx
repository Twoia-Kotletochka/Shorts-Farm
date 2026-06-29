import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  htmlFor?: string
  className?: string
  children: ReactNode
}

/** Обёртка поля формы: лейбл + подсказка/ошибка. */
export function Field({ label, hint, error, required, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-content-muted">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-content-faint">{hint}</p>
      ) : null}
    </div>
  )
}
