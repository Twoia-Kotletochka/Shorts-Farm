import type { LucideIcon } from 'lucide-react'
import { Badge, Card, CardHeader, CardContent, Progress } from '@/components/ui'
import type { Tone } from '@/lib/labels'
import type { UsageProvider } from '@/types/api'

function fmtNum(n: number): string {
  return n.toLocaleString('ru-RU')
}

export interface ProviderUsageCardProps {
  title: string
  icon: LucideIcon
  data: UsageProvider
  unit?: string
}

export function ProviderUsageCard({ title, icon: Icon, data, unit }: ProviderUsageCardProps) {
  const hasLimits = data.has_limits && data.limit != null && data.used != null
  let tone: Tone = 'primary'
  let pct = 0
  if (hasLimits) {
    pct = Math.min(1, (data.used ?? 0) / (data.limit || 1))
    tone = pct >= 0.9 ? 'danger' : pct >= 0.75 ? 'warning' : 'primary'
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-content-muted" />
            {title}
          </span>
        }
        description={data.provider}
        actions={
          data.available ? (
            <Badge tone="success" dot>
              Подключено
            </Badge>
          ) : (
            <Badge tone="danger" dot>
              Нет связи
            </Badge>
          )
        }
      />
      <CardContent className="pt-0">
        {hasLimits ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-content-muted">
                {fmtNum(data.used ?? 0)} / {fmtNum(data.limit ?? 0)} {unit}
              </span>
              <span className="font-medium text-content">{Math.round(pct * 100)}%</span>
            </div>
            <Progress value={pct} tone={tone} />
            <div className="text-xs text-content-faint">
              Осталось сегодня: {fmtNum(Math.max(0, (data.limit ?? 0) - (data.used ?? 0)))} {unit}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Badge tone="info">Без лимитов</Badge>
            {data.balance != null && (
              <span className="text-sm text-content-muted">Баланс: {String(data.balance)}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
