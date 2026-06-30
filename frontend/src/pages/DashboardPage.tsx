import { Link } from 'react-router-dom'
import {
  AudioLines,
  BrainCircuit,
  CheckCircle2,
  Clapperboard,
  HardDrive,
  ListChecks,
  Settings as SettingsIcon,
  TriangleAlert,
} from 'lucide-react'
import { useHealth, useJobs, useStats, useUsage } from '@/api/hooks'
import { Button, Card, Skeleton } from '@/components/ui'
import { MetricCard } from '@/features/dashboard/MetricCard'
import { ProviderUsageCard } from '@/features/dashboard/ProviderUsageCard'
import { HealthCard } from '@/features/dashboard/HealthCard'
import { ActiveJobs } from '@/features/dashboard/ActiveJobs'
import { formatGb } from '@/lib/format'
import { isHealthUp } from '@/lib/labels'

function ErrorCard({ onRetry }: { onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-2 p-6 text-center">
      <TriangleAlert className="h-6 w-6 text-danger" />
      <p className="text-sm text-content-muted">Не удалось загрузить</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </Card>
  )
}

export function DashboardPage() {
  const usage = useUsage()
  const stats = useStats()
  const health = useHealth()
  const jobs = useJobs()

  const activeCount =
    jobs.data?.filter(
      (j) => j.status === 'running' || j.status === 'queued' || j.status === 'waiting_limit',
    ).length ?? 0

  const needsSetup =
    health.data && (!isHealthUp(health.data.llm_provider) || !isHealthUp(health.data.stt_provider))

  const disk = usage.data?.disk
  const diskUsedPct = disk ? Math.round(((disk.total_gb - disk.free_gb) / disk.total_gb) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Онбординг: провайдер не настроен */}
      {needsSetup && (
        <Card className="flex items-center justify-between gap-4 border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center gap-3">
            <TriangleAlert className="h-5 w-5 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-medium text-content">AI-провайдер не настроен</p>
              <p className="text-content-muted">
                Подключите LLM и STT-провайдера, чтобы запускать генерацию.
              </p>
            </div>
          </div>
          <Link to="/settings">
            <Button variant="secondary" size="sm" leftIcon={<SettingsIcon className="h-4 w-4" />}>
              В настройки
            </Button>
          </Link>
        </Card>
      )}

      {/* Метрики */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.isLoading || usage.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)
        ) : (
          <>
            <MetricCard
              icon={Clapperboard}
              label="Сгенерировано"
              value={stats.data?.generated ?? '—'}
              tone="primary"
            />
            <MetricCard
              icon={CheckCircle2}
              label="Одобрено"
              value={stats.data?.approved ?? '—'}
              tone="success"
            />
            <MetricCard
              icon={ListChecks}
              label="Активные задачи"
              value={jobs.isError ? '—' : activeCount}
              tone="info"
              hint={<Link to="/queue" className="hover:text-content">Перейти в очередь →</Link>}
            />
            <MetricCard
              icon={HardDrive}
              label="Свободно на диске"
              value={formatGb(disk?.free_gb)}
              tone={diskUsedPct >= 90 ? 'warning' : 'primary'}
              hint={disk ? `из ${formatGb(disk.total_gb)} · занято ${diskUsedPct}%` : undefined}
            />
          </>
        )}
      </div>

      {/* Провайдеры + здоровье/задачи */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {usage.isError ? (
              <div className="sm:col-span-2">
                <ErrorCard onRetry={() => usage.refetch()} />
              </div>
            ) : usage.isLoading || !usage.data ? (
              <>
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
              </>
            ) : (
              <>
                <ProviderUsageCard
                  title="LLM-провайдер"
                  icon={BrainCircuit}
                  data={usage.data.llm}
                  unit="токенов"
                />
                <ProviderUsageCard
                  title="STT-провайдер"
                  icon={AudioLines}
                  data={usage.data.stt}
                  unit="аудио-сек"
                />
              </>
            )}
          </div>
          {jobs.isError ? (
            <ErrorCard onRetry={() => jobs.refetch()} />
          ) : jobs.data ? (
            <ActiveJobs jobs={jobs.data} />
          ) : (
            <Skeleton className="h-48" />
          )}
        </div>

        <div className="space-y-4">
          {health.isError ? (
            <ErrorCard onRetry={() => health.refetch()} />
          ) : health.data ? (
            <HealthCard health={health.data} />
          ) : (
            <Skeleton className="h-64" />
          )}
        </div>
      </div>
    </div>
  )
}
