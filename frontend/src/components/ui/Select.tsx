import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'w-full h-10 appearance-none rounded-md bg-surface border border-border pl-3 pr-9 text-sm text-content',
          'transition-colors hover:border-border-strong focus:border-primary focus:outline-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          invalid && 'border-danger focus:border-danger',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
    </div>
  )
})
