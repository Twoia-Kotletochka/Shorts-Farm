import { cn } from '@/lib/cn'
import type { Tone } from '@/lib/labels'

const BAR_TONES: Record<Tone, string> = {
  neutral: 'bg-content-faint',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}

export interface ProgressProps {
  /** значение 0..1 */
  value: number
  tone?: Tone
  className?: string
  /** мягкая анимация полоски */
  indeterminate?: boolean
}

export function Progress({ value, tone = 'primary', className, indeterminate }: ProgressProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', BAR_TONES[tone])}
        style={{ width: indeterminate ? '40%' : `${pct}%` }}
      />
    </div>
  )
}
