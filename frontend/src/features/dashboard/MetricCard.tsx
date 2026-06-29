import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/cn'

const ICON_TONES = {
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  info: 'bg-info/15 text-info',
  warning: 'bg-warning/15 text-warning',
} as const

export interface MetricCardProps {
  icon: LucideIcon
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: keyof typeof ICON_TONES
}

export function MetricCard({ icon: Icon, label, value, hint, tone = 'primary' }: MetricCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', ICON_TONES[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-content-muted">{label}</div>
          <div className="text-2xl font-semibold leading-tight text-content">{value}</div>
        </div>
      </div>
      {hint && <div className="mt-2 text-xs text-content-faint">{hint}</div>}
    </Card>
  )
}
