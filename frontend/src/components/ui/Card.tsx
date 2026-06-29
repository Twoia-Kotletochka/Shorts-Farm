import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-surface shadow-card', className)}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  title,
  description,
  actions,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div
      className={cn('flex items-start justify-between gap-3 px-5 pt-4 pb-3', className)}
      {...props}
    >
      <div className="min-w-0">
        {title && <h3 className="text-base font-semibold text-content">{title}</h3>}
        {description && <p className="mt-0.5 text-sm text-content-muted">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-2 border-t border-border px-5 py-3', className)}
      {...props}
    />
  )
}
