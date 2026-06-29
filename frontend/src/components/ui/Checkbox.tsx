import { useEffect, useRef } from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  label?: React.ReactNode
  className?: string
  /** Промежуточное состояние «часть выбрана» (показывает чёрточку, если не checked). */
  indeterminate?: boolean
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  id,
  label,
  className,
  indeterminate,
}: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)
  const showMinus = !!indeterminate && !checked
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = showMinus
  }, [showMinus])

  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex items-center gap-2 cursor-pointer select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <span className="relative inline-flex">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded border transition-colors',
            checked || showMinus
              ? 'bg-primary border-primary text-white'
              : 'bg-surface border-border-strong',
            'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary/70',
          )}
        >
          {checked ? (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          ) : showMinus ? (
            <Minus className="h-3.5 w-3.5" strokeWidth={3} />
          ) : null}
        </span>
      </span>
      {label && <span className="text-sm text-content">{label}</span>}
    </label>
  )
}
