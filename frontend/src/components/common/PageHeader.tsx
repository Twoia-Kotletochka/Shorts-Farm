import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface PageHeaderProps {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

/** Заголовок секции внутри страницы (описание + действия). Заголовок-название дублирует топбар — опционален. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {title && <h2 className="text-xl font-semibold text-content">{title}</h2>}
        {description && <p className="mt-1 text-sm text-content-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
