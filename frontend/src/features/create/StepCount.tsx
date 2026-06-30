import { Film, Layers } from 'lucide-react'
import { Field, Input, RangeSlider, Slider } from '@/components/ui'
import { FORMAT_LABELS } from '@/lib/labels'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import { SHORT_FORMATS, type ShortFormat } from '@/types/api'

interface StepCountProps {
  count: number
  format: ShortFormat
  segmentSec?: [number, number] | null
  totalSec?: number | null
  onCount: (n: number) => void
  onFormat: (f: ShortFormat) => void
  onSegmentSec: (v: [number, number]) => void
  onTotalSec: (n: number) => void
}

const FORMAT_ICON: Record<ShortFormat, typeof Film> = {
  single: Film,
  compilation: Layers,
}
const FORMAT_DESC: Record<ShortFormat, string> = {
  single: 'Сколько укажете — столько отдельных файлов. Длина каждого = «целевая длительность».',
  compilation: 'ОДИН ролик-монтаж из нескольких моментов. «Количество» = сколько моментов склеить.',
}

const clampCount = (n: number) => Math.max(1, Math.min(20, Math.round(n) || 1))

export function StepCount({
  count,
  format,
  segmentSec,
  totalSec,
  onCount,
  onFormat,
  onSegmentSec,
  onTotalSec,
}: StepCountProps) {
  const isComp = format === 'compilation'
  const seg = segmentSec ?? [6, 12]
  const total = totalSec ?? 60

  return (
    <div className="space-y-6">
      {/* Тип ролика — первым: он меняет смысл «Количества». */}
      <Field label="Тип ролика">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SHORT_FORMATS.map((f) => {
            const Icon = FORMAT_ICON[f]
            const active = f === format
            return (
              <button
                key={f}
                type="button"
                onClick={() => onFormat(f)}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                  active
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2',
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                    active ? 'bg-primary text-primary-fg' : 'bg-surface-3 text-content-faint',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-content">{FORMAT_LABELS[f]}</span>
                  <span className="mt-0.5 block text-xs text-content-faint">{FORMAT_DESC[f]}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Field>

      <Field
        label={isComp ? 'Сколько моментов склеить в ролик' : 'Сколько роликов сгенерировать'}
        hint={
          isComp
            ? 'Моменты внутри одного ролика-монтажа. На выходе — 1 файл.'
            : 'Каждый — отдельный файл. Больше — дольше обработка и расход лимитов.'
        }
      >
        <div className="flex items-center gap-4">
          <Slider value={count} onChange={(n) => onCount(clampCount(n))} min={1} max={20} />
          <Input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => onCount(clampCount(Number(e.target.value)))}
            className="w-20 text-center"
          />
        </div>
        <p className="text-xs text-content-faint">
          {isComp
            ? `${count} ${plural(count, 'момент', 'момента', 'моментов')} в одном ролике`
            : `${count} ${plural(count, 'ролик', 'ролика', 'роликов')}`}
        </p>
      </Field>

      {isComp && (
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface-2 p-4 sm:grid-cols-2">
          <Field label="Длина момента, сек" hint="Каждый хайлайт в монтаже (деф. 6–12)">
            <div className="flex items-center gap-3">
              <RangeSlider value={seg} onChange={onSegmentSec} min={3} max={20} step={1} />
              <span className="w-14 shrink-0 text-center font-mono text-sm text-content">
                {seg[0]}–{seg[1]}
              </span>
            </div>
          </Field>
          <Field label="Длина всего ролика, сек" hint="Общий бюджет монтажа (деф. 60)">
            <div className="flex items-center gap-3">
              <Slider value={total} onChange={(n) => onTotalSec(Math.round(n))} min={15} max={120} step={5} />
              <span className="w-10 shrink-0 text-center font-mono text-sm text-content">{total}</span>
            </div>
          </Field>
        </div>
      )}
    </div>
  )
}
