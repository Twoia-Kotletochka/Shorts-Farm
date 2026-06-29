import { Link } from 'react-router-dom'
import { Captions } from 'lucide-react'
import { usePresets } from '@/api/hooks'
import { Button, Field, Select, Skeleton, Switch } from '@/components/ui'
import { QueryBoundary } from '@/components/common/QueryBoundary'
import { SUBTITLE_POSITION_LABELS } from '@/lib/labels'
import { LANGUAGE_OPTIONS } from './wizard'

interface StepSubtitlesProps {
  subtitles: boolean
  presetId: number | null | undefined
  language: string | null | undefined
  onToggle: (b: boolean) => void
  onPreset: (id: number | null) => void
  onLanguage: (lang: string) => void
}

export function StepSubtitles({
  subtitles,
  presetId,
  language,
  onToggle,
  onPreset,
  onLanguage,
}: StepSubtitlesProps) {
  const presets = usePresets()

  return (
    <div className="space-y-5">
      <label className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface p-4">
        <span className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-3 text-content-faint">
            <Captions className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-medium text-content">Прожечь субтитры в видео</span>
            <span className="mt-0.5 block text-xs text-content-faint">
              Текст реплик поверх кадра — повышает удержание в ленте.
            </span>
          </span>
        </span>
        <Switch checked={subtitles} onChange={onToggle} aria-label="Субтитры" />
      </label>

      {subtitles && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Пресет оформления" hint="Шрифт, цвет, обводка и позиция текста.">
            <QueryBoundary
              query={presets}
              skeleton={<Skeleton className="h-10" />}
              isEmpty={(data) => data.length === 0}
              empty={
                <div className="space-y-2">
                  <p className="text-xs text-content-faint">Пресетов пока нет.</p>
                  <Link to="/subtitles">
                    <Button variant="secondary" size="sm">
                      Создать пресет
                    </Button>
                  </Link>
                </div>
              }
            >
              {(data) => (
                <Select
                  value={presetId ?? ''}
                  onChange={(e) =>
                    onPreset(e.target.value === '' ? null : Number(e.target.value))
                  }
                >
                  <option value="">По умолчанию</option>
                  {data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {SUBTITLE_POSITION_LABELS[p.position]}
                    </option>
                  ))}
                </Select>
              )}
            </QueryBoundary>
          </Field>

          <Field label="Язык субтитров" hint="Язык транскрипции и текста на экране.">
            <Select value={language ?? 'ru'} onChange={(e) => onLanguage(e.target.value)}>
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
    </div>
  )
}
