import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Plus, Save } from 'lucide-react'
import { Button, Card, CardContent, CardFooter, CardHeader, EmptyState, toast } from '@/components/ui'
import { ProviderCard } from './ProviderCard'
import { useUpdateSettings } from '@/api/hooks'
import { apiErrorMessage } from '@/api/http'
import { PROVIDER_PRESETS } from '@/lib/labels'
import type { ProviderConfig, Settings } from '@/types/api'

type Kind = 'llm' | 'stt'

interface ProviderListSectionProps {
  kind: Kind
  title: string
  icon: LucideIcon
  initial: ProviderConfig[]
}

function tmpId() {
  return 'tmp-' + Math.random().toString(36).slice(2, 10)
}

/** Заготовка нового провайдера (Groq — поддерживает и LLM, и STT). */
function blankProvider(kind: Kind): ProviderConfig {
  const p = PROVIDER_PRESETS.groq
  if (kind === 'llm') {
    return {
      id: tmpId(),
      type: 'groq',
      base_url: p.base_url,
      api_key: '',
      model: p.llm_models[0] ?? '',
      model_fast: p.llm_models_fast[0] ?? null,
      models: p.llm_models,
      models_fast: p.llm_models_fast,
    }
  }
  return {
    id: tmpId(),
    type: 'groq',
    base_url: p.base_url,
    api_key: '',
    model: p.stt_models[0] ?? 'whisper-large-v3-turbo',
  }
}

export function ProviderListSection({ kind, title, icon: Icon, initial }: ProviderListSectionProps) {
  const [list, setList] = useState<ProviderConfig[]>(initial)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const update = useUpdateSettings()
  const listKey = `${kind}_providers` as const

  // Ресинк с сервера только если секция «чистая» (пользователь не редактировал) — иначе не теряем правки.
  const seenRef = useRef(initial)
  useEffect(() => {
    if (initial === seenRef.current) return
    setList((cur) => (JSON.stringify(cur) === JSON.stringify(seenRef.current) ? initial : cur))
    seenRef.current = initial
  }, [initial])

  const sttInvalid =
    kind === 'stt' && list.some((p) => PROVIDER_PRESETS[p.type].stt_models.length === 0)
  const canSave = list.length > 0 && !sttInvalid

  const setAt = (i: number, next: ProviderConfig) =>
    setList((l) => l.map((p, j) => (j === i ? next : p)))
  const removeAt = (i: number) => setList((l) => l.filter((_, j) => j !== i))
  const add = () => setList((l) => [...l, blankProvider(kind)])
  const move = (from: number, to: number) =>
    setList((l) => {
      if (to < 0 || to >= l.length || from === to) return l
      const next = l.slice()
      const [it] = next.splice(from, 1)
      if (!it) return l
      next.splice(to, 0, it)
      return next
    })

  function save() {
    if (list.length === 0) {
      toast.error('Нужен хотя бы один провайдер')
      return
    }
    if (sttInvalid) {
      toast.error('Уберите из STT провайдеров без поддержки распознавания (Ollama/OpenRouter)')
      return
    }
    update.mutate({ [listKey]: list } as Partial<Settings>, {
      onSuccess: (data) => {
        toast.success(`${title}: сохранено`, `Провайдеров: ${list.length} (по приоритету)`)
        const fresh = (data as Settings)[listKey]
        if (Array.isArray(fresh)) setList(fresh) // канонич. состояние с id от сервера
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-content-muted" />
            {title}
          </span>
        }
        description="index 0 — основной; ниже — резервные (авто-переключение при лимите/ошибке)."
        actions={
          <Button variant="secondary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={add}>
            Добавить провайдер
          </Button>
        }
      />
      <CardContent className="space-y-3 pt-0">
        {list.length === 0 ? (
          <EmptyState
            title="Нет провайдеров"
            description="Добавьте хотя бы одного провайдера, чтобы шло распознавание/анализ."
            className="border-0 py-8"
          />
        ) : (
          list.map((p, i) => (
            <ProviderCard
              key={p.id ?? `idx-${i}`}
              kind={kind}
              provider={p}
              index={i}
              count={list.length}
              onChange={(next) => setAt(i, next)}
              onRemove={() => removeAt(i)}
              onMove={(delta) => move(i, i + delta)}
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex != null) move(dragIndex, i)
                setDragIndex(null)
              }}
              dragging={dragIndex === i}
            />
          ))
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Save className="h-4 w-4" />}
          loading={update.isPending}
          disabled={!canSave}
          onClick={save}
        >
          Сохранить порядок и настройки
        </Button>
      </CardFooter>
    </Card>
  )
}
