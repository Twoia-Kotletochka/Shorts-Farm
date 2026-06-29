import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  leftIcon?: ReactNode
  rightSlot?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, leftIcon, rightSlot, ...props },
  ref,
) {
  return (
    <div className="relative flex items-center">
      {leftIcon && (
        <span className="pointer-events-none absolute left-3 text-content-faint [&>svg]:h-4 [&>svg]:w-4">
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full h-10 rounded-md bg-surface border border-border px-3 text-sm text-content',
          'placeholder:text-content-faint transition-colors',
          'hover:border-border-strong focus:border-primary focus:outline-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          leftIcon && 'pl-9',
          rightSlot && 'pr-9',
          invalid && 'border-danger focus:border-danger',
          className,
        )}
        {...props}
      />
      {rightSlot && <span className="absolute right-2 flex items-center">{rightSlot}</span>}
    </div>
  )
})
