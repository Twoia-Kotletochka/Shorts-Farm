import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  label?: React.ReactNode
  className?: string
}

export function Checkbox({ checked, onChange, disabled, id, label, className }: CheckboxProps) {
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
            checked ? 'bg-primary border-primary text-white' : 'bg-surface border-border-strong',
            'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary/70',
          )}
        >
          {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
      </span>
      {label && <span className="text-sm text-content">{label}</span>}
    </label>
  )
}
