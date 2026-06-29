import { useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  RotateCcw,
  X,
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  Modal,
  Progress,
  toast,
  Tooltip,
} from '@/components/ui'
import { JobStatusBadge } from '@/components/common/badges'
import { useCancelJob, useRepeatJob, useSetJobPriority } from '@/api/hooks'
import { apiErrorMessage } from '@/api/http'
import { formatDateTime, formatRelative } from '@/lib/format'
import type { Job } from '@/types/api'
import { StagePipeline } from './StagePipeline'

const ACTIVE_STATUSES = ['queued', 'running', 'waiting_limit'] as const

function progressTone(status: Job['status']): 'primary' | 'warning' | 'danger' {
  if (status === 'waiting_limit') return 'warning'
  if (status === 'failed' || status === 'canceled') return 'danger'
  return 'primary'
}

export function JobCard({ job }: { job: Job }) {
  const cancel = useCancelJob()
  const repeat = useRepeatJob()
  const setPriority = useSetJobPriority()
  const [confirmCancel, setConfirmCancel] = useState(false)

  const isActive = (ACTIVE_STATUSES as readonly string[]).includes(job.status)
  const canCancel = isActive
  const isFailed = job.status === 'failed'
  const title = job.movie_title ?? `Фильм #${job.movie_id}`
  const pct = Math.round(job.progress * 100)

  const onCancel = () => {
    cancel.mutate(job.id, {
      onSuccess: () => {
        toast.success('Задача отменена')
        setConfirmCancel(false)
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }

  const onRepeat = () => {
    repeat.mutate(job.id, {
      onSuccess: () => toast.success('Задача добавлена в очередь повторно'),
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }

  const changePriority = (next: number) => {
    const clamped = Math.max(0, Math.min(9, next))
    if (clamped === job.priority) return
    setPriority.mutate(
      { id: job.id, priority: clamped },
      {
        onSuccess: () => toast.success(`Приоритет: ${clamped}`),
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  // Приоритет редактируется только для ожидающих (не трогаем текущие/running).
  const canPriority = job.status === 'queued' || job.status === 'waiting_limit'

  return (
    <Card className="animate-fade-in">
      <CardContent className="space-y-4">
        {/* Шапка */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold text-content">{title}</p>
            <p className="text-xs text-content-faint">
              Задача #{job.id} ·{' '}
              <Tooltip content={formatDateTime(job.created_at)}>
                <span>{formatRelative(job.created_at)}</span>
              </Tooltip>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PriorityControl
              value={job.priority}
              editable={canPriority}
              busy={setPriority.isPending}
              onChange={changePriority}
            />
            <JobStatusBadge status={job.status} />
          </div>
        </div>

        {/* Пайплайн */}
        <StagePipeline stage={job.stage} status={job.status} />

        {/* Прогресс */}
        <div className="space-y-1.5">
          <Progress value={job.progress} tone={progressTone(job.status)} />
          <div className="flex justify-between text-xs text-content-faint">
            <span>
              {job.status === 'done'
                ? 'Завершено'
                : job.status === 'failed'
                  ? 'Прервано ошибкой'
                  : job.status === 'canceled'
                    ? 'Отменено'
                    : 'Прогресс'}
            </span>
            <span className="tabular-nums font-medium text-content-muted">{pct}%</span>
          </div>
        </div>

        {/* Ожидание лимита */}
        {job.status === 'waiting_limit' && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Ждёт сброса дневного лимита провайдера.</span>
          </div>
        )}

        {/* Ошибка — полный текст */}
        {isFailed && job.error && (
          <div className="space-y-1 rounded-md border border-danger/30 bg-danger/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Ошибка выполнения
            </div>
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-danger/90">
              {job.error}
            </pre>
          </div>
        )}

        {/* Действия */}
        <div className="flex flex-wrap items-center gap-2">
          {(isFailed || job.status === 'canceled') && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              loading={repeat.isPending}
              onClick={onRepeat}
            >
              Повторить
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<X className="h-4 w-4" />}
              onClick={() => setConfirmCancel(true)}
            >
              Отменить
            </Button>
          )}
        </div>
      </CardContent>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Отменить задачу?"
        description={`«${title}» будет снята с очереди. Промежуточные результаты могут быть потеряны.`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
              Назад
            </Button>
            <Button variant="danger" loading={cancel.isPending} onClick={onCancel}>
              Отменить задачу
            </Button>
          </>
        }
      >
        <p className="text-sm text-content-muted">Это действие нельзя отменить.</p>
      </Modal>
    </Card>
  )
}

function PriorityControl({
  value,
  editable,
  busy,
  onChange,
}: {
  value: number
  editable: boolean
  busy: boolean
  onChange: (next: number) => void
}) {
  if (!editable) {
    return (
      <Tooltip content="Приоритет">
        <span className="inline-flex h-7 items-center rounded-md border border-border bg-surface-2 px-2 text-xs font-medium tabular-nums text-content-muted">
          P{value}
        </span>
      </Tooltip>
    )
  }
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-1">
      <span className="px-1 text-xs font-medium tabular-nums text-content-muted">P{value}</span>
      <Tooltip content="Поднять приоритет">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={busy || value >= 9}
          onClick={() => onChange(value + 1)}
          aria-label="Поднять приоритет"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Понизить приоритет">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={busy || value <= 0}
          onClick={() => onChange(value - 1)}
          aria-label="Понизить приоритет"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
  )
}
