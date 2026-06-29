import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TabItem<T extends string = string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  count?: number
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/** Сегментированные вкладки внутри страницы. */
export function Tabs<T extends string = string>({ items, value, onChange, className }: TabsProps<T>) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-lg bg-surface-2 p-1', className)}>
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-surface text-content shadow-sm'
                : 'text-content-muted hover:text-content',
            )}
          >
            {item.icon}
            {item.label}
            {item.count != null && (
              <span
                className={cn(
                  'ml-0.5 rounded-full px-1.5 text-xs',
                  active ? 'bg-primary/15 text-primary' : 'bg-surface-3 text-content-faint',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
