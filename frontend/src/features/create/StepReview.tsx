import { useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Infinity as InfinityIcon,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { apiErrorMessage } from '@/api/http'
import { useEstimateJob } from '@/api/hooks'
import {
  EFFECT_LABELS,
  FORMAT_LABELS,
  REFRAME_LABELS,
} from '@/lib/labels'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { JobParams } from '@/types/api'

type EstimateMutation = ReturnType<typeof useEstimateJob>

interface StepReviewProps {
  params: JobParams
  movieTitle: string
  presetName: string | null
  estimate: EstimateMutation
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-content-muted">{label}</span>
      <span className="text-right text-sm font-medium text-content">{children}</span>
    </div>
  )
}

export function StepReview({ params, movieTitle, presetName, estimate }: StepReviewProps) {
  const activeEffects = (Object.keys(EFFECT_LABELS) as (keyof typeof EFFECT_LABELS)[]).filter(
    (k) => params.effects[k],
  )

  // Прикидка при входе на шаг (и при смене параметров).
  const run = estimate.mutate
  useEffect(() => {
    run(params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, JSON.stringify(params)])

  return (
    <div className="space-y-5">
      <EstimateBanner estimate={estimate} />

      <div className="rounded-lg border border-border bg-surface">
        <div className="divide-y divide-border px-4">
          <SummaryRow label="Фильм">{movieTitle}</SummaryRow>
          <SummaryRow label="Категории">
            <span className="flex flex-wrap justify-end gap-1">
              {params.categories.length === 0 ? (
                '—'
              ) : (
                params.categories.map((c) => (
                  <Badge key={c} tone="primary">
                    {c}
                  </Badge>
                ))
              )}
            </span>
          </SummaryRow>
          <SummaryRow label="Количество">
            {params.count} · {FORMAT_LABELS[params.format]}
          </SummaryRow>
          <SummaryRow label="Субтитры">
            {params.subtitles ? (
              <span className="flex flex-wrap items-center justify-end gap-1.5">
                <Badge tone="success">Вкл</Badge>
                <span className="text-content-faint">
                  {presetName ?? 'по умолчанию'}
                  {params.subtitle_language ? ` · ${params.subtitle_language}` : ''}
                </span>
              </span>
            ) : (
              <Badge tone="neutral">Выкл</Badge>
            )}
          </SummaryRow>
          <SummaryRow label="Эффекты">
            {activeEffects.length === 0 ? (
              <span className="text-content-faint">нет</span>
            ) : (
              <span className="flex flex-wrap justify-end gap-1">
                {activeEffects.map((k) => (
                  <Badge key={k} tone="info">
                    {EFFECT_LABELS[k]}
                  </Badge>
                ))}
              </span>
            )}
          </SummaryRow>
          <SummaryRow label="Кадрирование">{REFRAME_LABELS[params.reframe]}</SummaryRow>
          <SummaryRow label="Длительность">
            {formatDuration(params.target_duration_sec[0])} – {formatDuration(
              params.target_duration_sec[1],
            )}
          </SummaryRow>
          <SummaryRow label="Язык контента">{params.language}</SummaryRow>
          {params.allow_duplicates && (
            <SummaryRow label="Повторы">
              <Badge tone="warning">разрешены</Badge>
            </SummaryRow>
          )}
        </div>
      </div>
    </div>
  )
}

function EstimateBanner({ estimate }: { estimate: EstimateMutation }) {
  if (estimate.isPending) {
    return (
      <Banner tone="neutral" icon={Loader2} iconSpin title="Считаем расход аудио-секунд…" />
    )
  }
  if (estimate.isError) {
    return (
      <Banner
        tone="danger"
        icon={AlertTriangle}
        title="Не удалось рассчитать прикидку"
        desc={apiErrorMessage(estimate.error)}
      />
    )
  }
  const data = estimate.data
  if (!data) return null

  if (data.unlimited) {
    return (
      <Banner
        tone="success"
        icon={InfinityIcon}
        title="Провайдер без лимитов"
        desc="STT-провайдер не ограничивает расход — задача стартует сразу."
      />
    )
  }

  const needed = data.whisper_audio_sec_needed
  const neededText =
    needed != null ? `Нужно ~${formatDuration(needed)} аудио для транскрипции.` : undefined

  if (data.fits_today) {
    return (
      <Banner
        tone="success"
        icon={CheckCircle2}
        title="Влезает в дневной лимит"
        desc={neededText}
      />
    )
  }
  return (
    <Banner
      tone="warning"
      icon={Clock}
      title="Может не влезть в дневной лимит"
      desc={`${neededText ?? ''} Задача подождёт сброса лимита и стартует позже.`.trim()}
    />
  )
}

const TONE_STYLES: Record<string, string> = {
  neutral: 'border-border bg-surface-2 text-content',
  success: 'border-success/30 bg-success/5 text-success',
  warning: 'border-warning/30 bg-warning/5 text-warning',
  danger: 'border-danger/30 bg-danger/5 text-danger',
}

function Banner({
  tone,
  icon: Icon,
  iconSpin,
  title,
  desc,
}: {
  tone: 'neutral' | 'success' | 'warning' | 'danger'
  icon: typeof Clock
  iconSpin?: boolean
  title: string
  desc?: string
}) {
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-4', TONE_STYLES[tone])}>
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconSpin && 'animate-spin')} />
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="mt-0.5 text-sm text-content-muted">{desc}</p>}
      </div>
    </div>
  )
}
