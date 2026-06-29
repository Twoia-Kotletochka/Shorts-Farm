import { useEffect, useState } from 'react'
import { Film, Save } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Field,
  RangeSlider,
  Select,
  Switch,
  toast,
} from '@/components/ui'
import { useUpdateSettings } from '@/api/hooks'
import { apiErrorMessage } from '@/api/http'
import { REFRAME_LABELS } from '@/lib/labels'
import { REFRAME_MODES } from '@/types/api'
import type { ReframeMode, RenderSettings } from '@/types/api'

const X264_PRESETS = [
  'ultrafast',
  'superfast',
  'veryfast',
  'faster',
  'fast',
  'medium',
  'slow',
  'slower',
  'veryslow',
] as const

const ENCODERS = ['auto', 'libx264'] as const

interface RenderSettingsFormProps {
  initial: RenderSettings
}

export function RenderSettingsForm({ initial }: RenderSettingsFormProps) {
  const update = useUpdateSettings()

  const [preset, setPreset] = useState(initial.preset)
  const [reframe, setReframe] = useState<ReframeMode>(initial.reframe)
  const [duration, setDuration] = useState<[number, number]>(initial.duration_range)
  const [trimSilence, setTrimSilence] = useState(initial.trim_silence)
  const [encoder, setEncoder] = useState(initial.encoder ?? 'auto')

  useEffect(() => {
    setPreset(initial.preset)
    setReframe(initial.reframe)
    setDuration(initial.duration_range)
    setTrimSilence(initial.trim_silence)
    setEncoder(initial.encoder ?? 'auto')
  }, [initial])

  function save() {
    const render: RenderSettings = {
      preset,
      reframe,
      duration_range: duration,
      trim_silence: trimSilence,
      encoder,
    }
    update.mutate(
      { render },
      {
        onSuccess: () => toast.success('Настройки рендера сохранены'),
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Film className="h-4 w-4 text-content-muted" />
            Рендер видео
          </span>
        }
        description="Качество кодирования и кадрирование вертикали 9:16."
      />
      <CardContent className="space-y-5 pt-0">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Пресет кодирования" hint="Баланс скорость / размер файла">
            <Select value={preset} onChange={(e) => setPreset(e.target.value)}>
              {X264_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Кодек (encoder)">
            <Select value={encoder} onChange={(e) => setEncoder(e.target.value)}>
              {ENCODERS.map((e) => (
                <option key={e} value={e}>
                  {e === 'auto' ? 'Авто (с GPU если есть)' : e}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Кадрирование (reframe)">
          <Select value={reframe} onChange={(e) => setReframe(e.target.value as ReframeMode)}>
            {REFRAME_MODES.map((m) => (
              <option key={m} value={m}>
                {REFRAME_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Длительность шортса"
          hint={`${duration[0]}–${duration[1]} сек`}
        >
          <RangeSlider value={duration} onChange={setDuration} min={5} max={90} step={1} />
        </Field>

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-3">
          <div>
            <p className="text-sm font-medium text-content">Авто-обрезка тишины</p>
            <p className="text-xs text-content-muted">Удалять долгие паузы внутри фрагмента.</p>
          </div>
          <Switch checked={trimSilence} onChange={setTrimSilence} />
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Save className="h-4 w-4" />}
          loading={update.isPending}
          onClick={save}
        >
          Сохранить
        </Button>
      </CardFooter>
    </Card>
  )
}
