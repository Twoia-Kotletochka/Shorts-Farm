import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

export interface SliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
}

/** Одиночный слайдер (нативный range, стилизованный). */
export function Slider({ value, onChange, min = 0, max = 100, step = 1, disabled, className }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn('sf-range w-full', className)}
      style={{ '--pct': `${pct}%` } as CSSProperties}
    />
  )
}

export interface RangeSliderProps {
  value: [number, number]
  onChange: (value: [number, number]) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
}

/** Двойной слайдер диапазона (две накладывающиеся ручки). */
export function RangeSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  className,
}: RangeSliderProps) {
  const [lo, hi] = value
  const loPct = ((lo - min) / (max - min)) * 100
  const hiPct = ((hi - min) / (max - min)) * 100

  return (
    <div className={cn('relative h-6 w-full', className)}>
      {/* трек */}
      <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-surface-3" />
      {/* активный отрезок */}
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
        style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={lo}
        disabled={disabled}
        onChange={(e) => onChange([Math.min(Number(e.target.value), hi - step), hi])}
        className="sf-range-thumb absolute inset-0 w-full"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={hi}
        disabled={disabled}
        onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo + step)])}
        className="sf-range-thumb absolute inset-0 w-full"
      />
    </div>
  )
}
