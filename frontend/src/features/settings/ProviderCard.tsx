import type { DragEvent } from 'react'
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  PlugZap,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { Badge, Button, Field, Input, Select, toast } from '@/components/ui'
import { ModelListEditor } from './ModelListEditor'
import { ExtraHeadersEditor } from './ExtraHeadersEditor'
import { useTestProvider } from '@/api/hooks'
import { apiErrorMessage } from '@/api/http'
import { FRIEND_STT_BASE_URL, PROVIDER_PRESETS, PROVIDER_TYPE_LABELS } from '@/lib/labels'
import { PROVIDER_TYPES } from '@/types/api'
import type { ProviderConfig, ProviderType } from '@/types/api'
import { cn } from '@/lib/cn'

const MASKED_RE = /\*{2,}/
const PRESET_BUTTONS: ProviderType[] = ['groq', 'openrouter', 'ollama', 'friend']
const CF_HEADERS = ['CF-Access-Client-Id', 'CF-Access-Client-Secret'] as const

export interface ProviderCardProps {
  kind: 'llm' | 'stt'
  provider: ProviderConfig
  index: number
  count: number
  onChange: (next: ProviderConfig) => void
  onRemove: () => void
  onMove: (delta: -1 | 1) => void
  onDragStart: () => void
  onDragOver: (e: DragEvent) => void
  onDrop: () => void
  dragging: boolean
}

export function ProviderCard({
  kind,
  provider,
  index,
  count,
  onChange,
  onRemove,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  dragging,
}: ProviderCardProps) {
  const isLlm = kind === 'llm'
  const test = useTestProvider()
  const preset = PROVIDER_PRESETS[provider.type]
  const sttUnsupported = !isLlm && preset.stt_models.length === 0
  const incomingMasked = MASKED_RE.test(provider.api_key ?? '')
  const models = provider.models ?? (provider.model ? [provider.model] : [])
  const modelsFast = provider.models_fast ?? (provider.model_fast ? [provider.model_fast] : [])
  const invalid = sttUnsupported || (isLlm && models.length === 0) || (!isLlm && !provider.model.trim())

  const patch = (p: Partial<ProviderConfig>) => onChange({ ...provider, ...p })

  function applyType(next: ProviderType) {
    const pr = PROVIDER_PRESETS[next]
    // Friend: у STT свой корневой base_url; пресет заводит пустые строки CF-Access.
    const base_url = next === 'friend' && !isLlm ? FRIEND_STT_BASE_URL : pr.base_url
    const extra: Partial<ProviderConfig> = {}
    if (next === 'friend') {
      const cur = provider.extra_headers ?? {}
      const seeded: Record<string, string> = { ...cur }
      for (const h of CF_HEADERS) seeded[h] = cur[h] ?? ''
      extra.extra_headers = seeded
    }
    if (isLlm) {
      patch({
        type: next,
        base_url,
        api_key: '', // новый тип — свой ключ
        models: pr.llm_models,
        models_fast: pr.llm_models_fast,
        model: pr.llm_models[0] ?? '',
        model_fast: pr.llm_models_fast[0] ?? null,
        ...extra,
      })
    } else {
      patch({ type: next, base_url, api_key: '', model: pr.stt_models[0] ?? '', ...extra })
    }
  }

  function handleTest() {
    const config: ProviderConfig = isLlm
      ? { ...provider, model: models[0] ?? provider.model, models, models_fast: modelsFast }
      : { ...provider }
    test.mutate(
      { kind, config },
      {
        onSuccess: (res) => {
          if (res.ok) toast.success(`#${index + 1} ${PROVIDER_TYPE_LABELS[provider.type]}`, 'Подключение успешно')
          else toast.error(`#${index + 1}: не удалось`, res.error || 'провайдер недоступен')
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        'rounded-lg border bg-surface transition-colors',
        dragging ? 'border-primary/60 opacity-60' : 'border-border',
      )}
    >
      {/* Шапка: приоритет + перетаскивание + управление */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span
          draggable
          onDragStart={onDragStart}
          className="cursor-grab text-content-faint hover:text-content active:cursor-grabbing"
          aria-label="Перетащить для смены приоритета"
          title="Перетащить"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <Badge tone={index === 0 ? 'primary' : 'neutral'}>
          {index === 0 ? 'основной' : `резерв #${index}`}
        </Badge>
        <Badge tone="neutral">{PROVIDER_TYPE_LABELS[provider.type]}</Badge>
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Поднять приоритет"
            className="rounded p-1 text-content-faint hover:text-content disabled:opacity-30"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            aria-label="Понизить приоритет"
            className="rounded p-1 text-content-faint hover:text-content disabled:opacity-30"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Удалить провайдер"
            className="rounded p-1 text-content-faint hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="flex flex-wrap gap-2">
          {PRESET_BUTTONS.map((p) => (
            <Button
              key={p}
              variant={provider.type === p ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => applyType(p)}
            >
              {PROVIDER_TYPE_LABELS[p]}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Тип">
            <Select value={provider.type} onChange={(e) => applyType(e.target.value as ProviderType)}>
              {PROVIDER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROVIDER_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Base URL">
            <Input
              value={provider.base_url ?? ''}
              onChange={(e) => patch({ base_url: e.target.value })}
              placeholder="https://..."
            />
          </Field>
        </div>

        <Field
          label="API-ключ"
          hint={
            incomingMasked
              ? 'Ключ задан. Оставьте без изменений, чтобы сохранить текущий.'
              : provider.id
                ? undefined
                : 'Новый провайдер — введите реальный ключ (иначе сохранится пустым).'
          }
        >
          <Input
            type="password"
            value={provider.api_key ?? ''}
            onChange={(e) => patch({ api_key: e.target.value })}
            placeholder={incomingMasked ? 'оставьте без изменений' : 'вставьте ключ'}
          />
        </Field>

        {isLlm ? (
          <div className="space-y-3">
            <ModelListEditor
              label="Модели (по приоритету)"
              hint="Балансир моделей внутри провайдера: перебор сверху вниз при лимите/ошибке."
              value={models}
              onChange={(m) => patch({ models: m, model: m[0] ?? provider.model })}
              suggestions={preset.llm_models}
            />
            <ModelListEditor
              label="Быстрые модели (по приоритету)"
              hint="Для дешёвого первого прохода. Можно оставить пустым."
              value={modelsFast}
              onChange={(m) => patch({ models_fast: m, model_fast: m[0] ?? null })}
              suggestions={preset.llm_models_fast}
            />
          </div>
        ) : (
          <Field label="Модель (Whisper)">
            {preset.stt_models.length > 0 ? (
              <Select value={provider.model} onChange={(e) => patch({ model: e.target.value })}>
                {!preset.stt_models.includes(provider.model) && provider.model && (
                  <option value={provider.model}>{provider.model}</option>
                )}
                {preset.stt_models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                value={provider.model}
                onChange={(e) => patch({ model: e.target.value })}
                placeholder="имя модели"
              />
            )}
          </Field>
        )}

        <ExtraHeadersEditor
          value={provider.extra_headers}
          onChange={(h) => patch({ extra_headers: h })}
        />

        {preset.note && <p className="text-xs text-content-faint">{preset.note}</p>}
        {sttUnsupported && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2.5 text-xs text-content-muted">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              {PROVIDER_TYPE_LABELS[provider.type]} не поддерживает распознавание речи. Для STT
              выберите Groq или OpenAI.
            </span>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<PlugZap className="h-4 w-4" />}
            loading={test.isPending}
            disabled={invalid}
            onClick={handleTest}
          >
            Проверить подключение
          </Button>
        </div>
      </div>
    </div>
  )
}
