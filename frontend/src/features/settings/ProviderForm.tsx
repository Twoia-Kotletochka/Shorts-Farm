import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { PlugZap, Save, TriangleAlert, Zap } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Field,
  Input,
  Select,
  toast,
} from '@/components/ui'
import { useTestProvider, useUpdateSettings } from '@/api/hooks'
import { apiErrorMessage } from '@/api/http'
import { PROVIDER_PRESETS, PROVIDER_TYPE_LABELS } from '@/lib/labels'
import { PROVIDER_TYPES } from '@/types/api'
import type { ProviderConfig, ProviderType } from '@/types/api'

/** Эвристика: ключ пришёл замаскированным с бэкенда (звёздочки) — не перезатираем. */
const MASKED_RE = /\*{2,}/

type Kind = 'llm' | 'stt'

interface ProviderFormProps {
  kind: Kind
  title: string
  icon: LucideIcon
  initial: ProviderConfig
}

export function ProviderForm({ kind, title, icon: Icon, initial }: ProviderFormProps) {
  const isLlm = kind === 'llm'
  const update = useUpdateSettings()
  const test = useTestProvider()

  const [type, setType] = useState<ProviderType>(initial.type)
  const [baseUrl, setBaseUrl] = useState(initial.base_url ?? '')
  const [apiKey, setApiKey] = useState(initial.api_key ?? '')
  const [model, setModel] = useState(initial.model)
  const [modelFast, setModelFast] = useState(initial.model_fast ?? '')
  // Был ли ключ отредактирован пользователем (иначе шлём как пришёл — маску).
  const [keyTouched, setKeyTouched] = useState(false)

  // Реинициализация при перезагрузке данных извне.
  useEffect(() => {
    setType(initial.type)
    setBaseUrl(initial.base_url ?? '')
    setApiKey(initial.api_key ?? '')
    setModel(initial.model)
    setModelFast(initial.model_fast ?? '')
    setKeyTouched(false)
  }, [initial])

  const preset = PROVIDER_PRESETS[type]
  const modelList = isLlm ? preset.llm_models : preset.stt_models
  const needsKey = preset.needs_key
  const sttUnsupported = !isLlm && modelList.length === 0
  const incomingMasked = MASKED_RE.test(initial.api_key ?? '')

  function applyType(next: ProviderType) {
    setType(next)
    const p = PROVIDER_PRESETS[next]
    setBaseUrl(p.base_url)
    const list = isLlm ? p.llm_models : p.stt_models
    setModel(list[0] ?? '')
    if (isLlm) setModelFast(p.llm_models[1] ?? p.llm_models[0] ?? '')
  }

  function buildConfig(): ProviderConfig {
    // Если ключ не трогали и он пришёл замаскированным — отдаём как есть (бэкенд сохранит старый).
    const key = !keyTouched && incomingMasked ? (initial.api_key ?? '') : apiKey
    const cfg: ProviderConfig = {
      type,
      base_url: baseUrl.trim() || null,
      api_key: key.trim() ? key : null,
      model: model.trim(),
    }
    if (isLlm) cfg.model_fast = modelFast.trim() || null
    return cfg
  }

  function handleTest() {
    test.mutate(
      { kind, config: buildConfig() },
      {
        onSuccess: (res) => {
          if (res.ok) toast.success('Подключение успешно')
          else toast.error(res.error || 'Провайдер недоступен')
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  function handleSave() {
    const body = isLlm ? { llm_provider: buildConfig() } : { stt_provider: buildConfig() }
    update.mutate(body, {
      onSuccess: () => toast.success(`${title}: сохранено`),
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }

  const presetButtons: ProviderType[] = ['groq', 'openrouter', 'ollama']

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-content-muted" />
            {title}
          </span>
        }
        description={isLlm ? 'Анализ моментов и метаданные' : 'Распознавание речи (Whisper)'}
        actions={<Badge tone="neutral">{PROVIDER_TYPE_LABELS[type]}</Badge>}
      />
      <CardContent className="space-y-4 pt-0">
        {/* Быстрые пресеты */}
        <div className="flex flex-wrap gap-2">
          {presetButtons.map((p) => (
            <Button
              key={p}
              variant={type === p ? 'secondary' : 'ghost'}
              size="sm"
              leftIcon={<Zap className="h-3.5 w-3.5" />}
              onClick={() => applyType(p)}
            >
              {PROVIDER_TYPE_LABELS[p]}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Тип провайдера">
            <Select value={type} onChange={(e) => applyType(e.target.value as ProviderType)}>
              {PROVIDER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROVIDER_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Base URL">
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
        </div>

        <Field
          label="API-ключ"
          required={needsKey}
          hint={
            incomingMasked
              ? 'Ключ задан. Оставьте без изменений, чтобы сохранить текущий.'
              : undefined
          }
        >
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              setKeyTouched(true)
            }}
            placeholder={incomingMasked ? 'оставьте без изменений' : 'вставьте ключ'}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Модель">
            {modelList.length > 0 ? (
              <Select value={model} onChange={(e) => setModel(e.target.value)}>
                {/* Сохраняем кастомную модель, если её нет в пресете. */}
                {!modelList.includes(model) && model && <option value={model}>{model}</option>}
                {modelList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="имя модели"
              />
            )}
          </Field>
          {isLlm && (
            <Field label="Быстрая модель" hint="Для дешёвого первого прохода (опционально)">
              <Input
                value={modelFast}
                onChange={(e) => setModelFast(e.target.value)}
                placeholder="llama-3.1-8b-instant"
              />
            </Field>
          )}
        </div>

        {preset.note && (
          <p className="text-xs text-content-faint">{preset.note}</p>
        )}

        {sttUnsupported && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2.5 text-xs text-content-muted">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              {PROVIDER_TYPE_LABELS[type]} не поддерживает распознавание речи. Для STT выберите
              Groq или OpenAI.
            </span>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<PlugZap className="h-4 w-4" />}
          loading={test.isPending}
          onClick={handleTest}
        >
          Проверить подключение
        </Button>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Save className="h-4 w-4" />}
          loading={update.isPending}
          onClick={handleSave}
        >
          Сохранить
        </Button>
      </CardFooter>
    </Card>
  )
}
