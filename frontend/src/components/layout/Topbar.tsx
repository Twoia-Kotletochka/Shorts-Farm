import { useLocation } from 'react-router-dom'
import { titleForPath } from '@/app/nav'
import { useHealth } from '@/api/hooks'
import { Badge } from '@/components/ui'
import { IS_MOCK } from '@/api/http'
import { cn } from '@/lib/cn'

export function Topbar() {
  const { pathname } = useLocation()
  const { data: health } = useHealth()

  const services = health
    ? [health.api, health.redis, health.worker]
    : []
  const allUp = services.length > 0 && services.every(Boolean)

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-bg/80 px-6 backdrop-blur">
      <h1 className="text-lg font-semibold text-content">{titleForPath(pathname)}</h1>
      <div className="flex items-center gap-3">
        {IS_MOCK && <Badge tone="warning">демо-режим</Badge>}
        {health && (
          <div className="flex items-center gap-2 text-xs text-content-muted">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                allUp ? 'bg-success' : 'bg-danger',
              )}
            />
            {allUp ? 'Сервисы в норме' : 'Есть проблемы'}
          </div>
        )}
      </div>
    </header>
  )
}
