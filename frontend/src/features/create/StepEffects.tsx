import { Crop, FlipHorizontal2, Image, Sparkles, ZoomIn } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Field, Switch } from '@/components/ui'
import { EFFECT_LABELS, REFRAME_LABELS } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { REFRAME_MODES, type JobEffects, type ReframeMode } from '@/types/api'

interface StepEffectsProps {
  effects: JobEffects
  reframe: ReframeMode
  onEffect: (key: keyof JobEffects, value: boolean) => void
  onReframe: (mode: ReframeMode) => void
}

const EFFECT_META: { key: keyof JobEffects; icon: LucideIcon; desc: string }[] = [
  { key: 'mirror', icon: FlipHorizontal2, desc: 'Горизонтальное отражение — обход анти-копи фильтров.' },
  { key: 'enhance', icon: Sparkles, desc: 'Лёгкое улучшение резкости и цвета.' },
  { key: 'zoom', icon: ZoomIn, desc: 'Медленный наезд камеры для динамики.' },
]

const REFRAME_ICON: Record<ReframeMode, LucideIcon> = {
  smartcrop: Crop,
  blurpad: Image,
}
const REFRAME_DESC: Record<ReframeMode, string> = {
  smartcrop: 'Кадрирование 9:16 по центру действия — без полос.',
  blurpad: 'Полный кадр по центру, сверху и снизу — размытый фон.',
}

export function StepEffects({ effects, reframe, onEffect, onReframe }: StepEffectsProps) {
  return (
    <div className="space-y-6">
      <Field label="Эффекты обработки">
        <div className="space-y-2">
          {EFFECT_META.map(({ key, icon: Icon, desc }) => (
            <label
              key={key}
              className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface p-3.5"
            >
              <span className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-3 text-content-faint">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-content">
                    {EFFECT_LABELS[key]}
                  </span>
                  <span className="mt-0.5 block text-xs text-content-faint">{desc}</span>
                </span>
              </span>
              <Switch
                checked={effects[key]}
                onChange={(v) => onEffect(key, v)}
                aria-label={EFFECT_LABELS[key]}
              />
            </label>
          ))}
        </div>
      </Field>

      <Field label="Переформатирование в вертикаль (9:16)">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {REFRAME_MODES.map((mode) => {
            const Icon = REFRAME_ICON[mode]
            const active = mode === reframe
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onReframe(mode)}
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
                  <span className="block text-sm font-medium text-content">
                    {REFRAME_LABELS[mode]}
                  </span>
                  <span className="mt-0.5 block text-xs text-content-faint">
                    {REFRAME_DESC[mode]}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </Field>
    </div>
  )
}
