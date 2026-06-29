import { cn } from '@/lib/cn'
import { JOB_STAGE_LABELS, PIPELINE_STAGES } from '@/lib/labels'
import type { JobStage, JobStatus } from '@/types/api'

interface StagePipelineProps {
  stage: JobStage | null
  status: JobStatus
}

/**
 * Стадия awaiting_approval отсутствует в PIPELINE_STAGES (она вне линейного
 * прогресса) — показываем её как завершённый предпросмотр перед рендером.
 */
function pipelineIndex(stage: JobStage): number {
  if (stage === 'awaiting_approval') return PIPELINE_STAGES.indexOf('preview')
  return PIPELINE_STAGES.indexOf(stage)
}

/** Горизонтальный индикатор пайплайна: пройденные + текущая — primary, будущие — faint. */
export function StagePipeline({ stage, status }: StagePipelineProps) {
  const isDone = status === 'done'
  // Индекс текущей стадии в порядке пайплайна. Для done — всё пройдено.
  const currentIdx = isDone
    ? PIPELINE_STAGES.length - 1
    : stage
      ? pipelineIndex(stage)
      : -1

  const isFailed = status === 'failed' || status === 'canceled'

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {PIPELINE_STAGES.map((s, i) => {
          const passed = currentIdx >= 0 && i <= currentIdx
          const isCurrent = !isDone && i === currentIdx
          return (
            <div
              key={s}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                passed
                  ? isFailed
                    ? 'bg-danger/60'
                    : 'bg-primary'
                  : 'bg-surface-3',
                isCurrent && !isFailed && 'animate-pulse',
              )}
              title={JOB_STAGE_LABELS[s]}
            />
          )
        })}
      </div>
      {stage && (
        <p className="text-xs text-content-faint">
          Стадия:{' '}
          <span className={cn('font-medium', isFailed ? 'text-danger' : 'text-content-muted')}>
            {JOB_STAGE_LABELS[stage]}
          </span>
        </p>
      )}
    </div>
  )
}
