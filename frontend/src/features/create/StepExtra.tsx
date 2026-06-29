import { Copy } from 'lucide-react'
import { Field, RangeSlider, Select, Switch } from '@/components/ui'
import { formatDuration } from '@/lib/format'
import { LANGUAGE_OPTIONS } from './wizard'

interface StepExtraProps {
  duration: [number, number]
  language: string
  allowDuplicates: boolean
  onDuration: (v: [number, number]) => void
  onLanguage: (lang: string) => void
  onAllowDuplicates: (b: boolean) => void
}

export function StepExtra({
  duration,
  language,
  allowDuplicates,
  onDuration,
  onLanguage,
  onAllowDuplicates,
}: StepExtraProps) {
  const [lo, hi] = duration
  return (
    <div className="space-y-6">
      <Field
        label="Целевая длительность шортса"
        hint="Алгоритм будет стараться уложить момент в этот диапазон."
      >
        <div className="space-y-3 pt-1">
          <RangeSlider value={duration} onChange={onDuration} min={5} max={90} step={1} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-content-muted">
              от <span className="font-medium text-content">{formatDuration(lo)}</span>
            </span>
            <span className="text-content-muted">
              до <span className="font-medium text-content">{formatDuration(hi)}</span>
            </span>
          </div>
        </div>
      </Field>

      <Field
        label="Язык контента и метаданных"
        hint="На этом языке LLM напишет заголовки, описания и хэштеги."
      >
        <Select value={language} onChange={(e) => onLanguage(e.target.value)}>
          {LANGUAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>

      <label className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface p-4">
        <span className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-3 text-content-faint">
            <Copy className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-medium text-content">
              Разрешить повторные моменты
            </span>
            <span className="mt-0.5 block text-xs text-content-faint">
              Иначе алгоритм пропустит сцены, по которым уже есть шортсы.
            </span>
          </span>
        </span>
        <Switch
          checked={allowDuplicates}
          onChange={onAllowDuplicates}
          aria-label="Разрешить повторные моменты"
        />
      </label>
    </div>
  )
}
