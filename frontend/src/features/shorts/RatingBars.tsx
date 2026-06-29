import { Star } from 'lucide-react'
import { Progress } from '@/components/ui'
import { RATING_CRITERIA } from '@/lib/labels'
import { ratingFraction, ratingTo100 } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ShortRating } from '@/types/api'

/** Тон полоски/балла по значению 0..100. */
function toneFor(v: number): 'success' | 'primary' | 'warning' | 'danger' {
  if (v >= 80) return 'success'
  if (v >= 60) return 'primary'
  if (v >= 40) return 'warning'
  return 'danger'
}

const TEXT_TONE = {
  success: 'text-success',
  primary: 'text-primary',
  warning: 'text-warning',
  danger: 'text-danger',
} as const

/** Крупный общий балл + полоски по критериям отбора. */
export function RatingBars({ rating, reason }: { rating: ShortRating; reason?: string | null }) {
  const overallTone = toneFor(rating.overall)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3">
        <div className={cn('flex items-center gap-1.5 text-3xl font-bold leading-none', TEXT_TONE[overallTone])}>
          <Star className="h-6 w-6 fill-current" />
          {ratingTo100(rating.overall)}
        </div>
        <div className="text-xs text-content-faint">
          Общий
          <br />
          балл / 100
        </div>
      </div>

      <ul className="space-y-2.5">
        {RATING_CRITERIA.map(({ key, label }) => {
          const v = rating[key]
          return (
            <li key={key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-content-muted">{label}</span>
                <span className="font-medium text-content">{Math.round(v)}</span>
              </div>
              <Progress value={ratingFraction(v)} tone={toneFor(v)} />
            </li>
          )
        })}
      </ul>

      {reason && (
        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
          <p className="mb-1 text-xs font-medium text-content-muted">Почему отобран</p>
          <p className="text-sm leading-relaxed text-content">{reason}</p>
        </div>
      )}
    </div>
  )
}
