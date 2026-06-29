import { Card, CardHeader, CardContent } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Health, HealthFlag } from '@/types/api'

function flagUp(v: HealthFlag): boolean {
  return v === true || v === 'ok'
}

const ROWS: { key: keyof Health; label: string }[] = [
  { key: 'api', label: 'API' },
  { key: 'redis', label: 'Redis' },
  { key: 'worker', label: 'Worker' },
  { key: 'llm_provider', label: 'LLM-провайдер' },
  { key: 'stt_provider', label: 'STT-провайдер' },
]

export function HealthCard({ health }: { health: Health }) {
  return (
    <Card>
      <CardHeader title="Здоровье сервисов" />
      <CardContent className="pt-0">
        <ul className="divide-y divide-border">
          {ROWS.map(({ key, label }) => {
            const v = health[key]
            const up = flagUp(v)
            const notConfigured = v === 'not_configured'
            return (
              <li key={key} className="flex items-center justify-between py-2 text-sm">
                <span className="text-content-muted">{label}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      up ? 'bg-success' : notConfigured ? 'bg-content-faint' : 'bg-danger',
                    )}
                  />
                  <span className={cn('text-xs', up ? 'text-success' : 'text-content-faint')}>
                    {up ? 'OK' : notConfigured ? 'не настроен' : 'недоступен'}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
