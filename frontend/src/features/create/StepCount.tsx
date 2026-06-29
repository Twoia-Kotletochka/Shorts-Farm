import { Film, Layers } from 'lucide-react'
import { Field, Input, Slider } from '@/components/ui'
import { FORMAT_LABELS } from '@/lib/labels'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import { SHORT_FORMATS, type ShortFormat } from '@/types/api'

interface StepCountProps {
  count: number
  format: ShortFormat
  onCount: (n: number) => void
  onFormat: (f: ShortFormat) => void
}

const FORMAT_ICON: Record<ShortFormat, typeof Film> = {
  single: Film,
  compilation: Layers,
}
const FORMAT_DESC: Record<ShortFormat, string> = {
  single: 'Каждый шортс — один цельный момент из фильма.',
  compilation: 'Шортс собирается из нескольких коротких моментов подряд.',
}

const clampCount = (n: number) => Math.max(1, Math.min(20, Math.round(n) || 1))

export function StepCount({ count, format, onCount, onFormat }: StepCountProps) {
  return (
    <div className="space-y-6">
      <Field
        label="Сколько шортсов сгенерировать"
        hint="От 1 до 20. Больше моментов — дольше обработка и расход лимитов."
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
          {count} {plural(count, 'шортс', 'шортса', 'шортсов')}
        </p>
      </Field>

      <Field label="Тип шортса">
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
    </div>
  )
}
