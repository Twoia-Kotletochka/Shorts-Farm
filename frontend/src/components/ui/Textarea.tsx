import { forwardRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full min-h-[80px] rounded-md bg-surface border border-border px-3 py-2 text-sm text-content',
        'placeholder:text-content-faint transition-colors resize-y',
        'hover:border-border-strong focus:border-primary focus:outline-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        invalid && 'border-danger focus:border-danger',
        className,
      )}
      {...props}
    />
  )
})
