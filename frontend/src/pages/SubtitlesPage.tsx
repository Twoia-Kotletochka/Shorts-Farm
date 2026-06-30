import { useEffect, useMemo, useState } from 'react'
import { Captions, Check, Plus, Type } from 'lucide-react'
import type { SubtitlePreset, SubtitlePresetInput } from '@/types/api'
import {
  useCreatePreset,
  useDeletePreset,
  usePresets,
  useUpdatePreset,
} from '@/api/hooks'
import { apiErrorMessage } from '@/api/http'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  Skeleton,
  toast,
} from '@/components/ui'
import { PageHeader } from '@/components/common/PageHeader'
import { QueryBoundary } from '@/components/common/QueryBoundary'
import { SUBTITLE_POSITION_LABELS } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { PresetEditor } from '@/features/subtitles/PresetEditor'

const NEW_ID = -1

/** Заготовка нового пресета. */
function blankPreset(): SubtitlePresetInput {
  return {
    name: '',
    font: 'Inter',
    size: 54,
    color: '#FFFFFF',
    outline: '#000000',
    background: null,
    position: 'bottom',
    style_json: { safe_area: true, outline_width: 3 },
    language: 'ru',
  }
}

function toInput(p: SubtitlePreset): SubtitlePresetInput {
  const { id: _id, ...rest } = p
  return { ...rest, style_json: { ...rest.style_json } }
}

export function SubtitlesPage() {
  const presetsQuery = usePresets()
  const createPreset = useCreatePreset()
  const updatePreset = useUpdatePreset()
  const deletePreset = useDeletePreset()

  // -1 → новый пресет; иначе id выбранного.
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState<SubtitlePresetInput>(blankPreset)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const presets = presetsQuery.data

  // Автовыбор первого пресета при загрузке.
  useEffect(() => {
    if (selectedId !== null) return
    if (presets && presets.length > 0) {
      const first = presets[0]
      if (first) {
        setSelectedId(first.id)
        setDraft(toInput(first))
      }
    }
  }, [presets, selectedId])

  const guardDirty = () =>
    !dirty || window.confirm('Несохранённые изменения пресета будут потеряны. Продолжить?')

  const selectExisting = (p: SubtitlePreset) => {
    if (p.id === selectedId) return // клик по уже активному — ничего не теряем
    if (!guardDirty()) return
    setSelectedId(p.id)
    setDraft(toInput(p))
  }

  const startNew = () => {
    if (!guardDirty()) return
    setSelectedId(NEW_ID)
    setDraft(blankPreset())
  }

  const isNew = selectedId === NEW_ID

  const original = useMemo(
    () => (presets ?? []).find((p) => p.id === selectedId),
    [presets, selectedId],
  )

  const dirty = useMemo(() => {
    if (isNew) return true
    if (!original) return false
    return JSON.stringify(toInput(original)) !== JSON.stringify(draft)
  }, [isNew, original, draft])

  const handleSave = () => {
    const body = draft
    if (isNew) {
      createPreset.mutate(body, {
        onSuccess: (created) => {
          toast.success('Пресет создан', `«${created.name}» добавлен`)
          setSelectedId(created.id)
          setDraft(toInput(created))
        },
        onError: (err) => toast.error('Не удалось создать', apiErrorMessage(err)),
      })
    } else if (selectedId !== null) {
      updatePreset.mutate(
        { id: selectedId, body },
        {
          onSuccess: () => toast.success('Сохранено', `Пресет «${body.name}» обновлён`),
          onError: (err) => toast.error('Не удалось сохранить', apiErrorMessage(err)),
        },
      )
    }
  }

  const handleDelete = () => {
    if (selectedId === null || isNew) return
    const id = selectedId
    deletePreset.mutate(id, {
      onSuccess: () => {
        toast.success('Пресет удалён')
        setConfirmDelete(false)
        const rest = (presets ?? []).filter((p) => p.id !== id)
        const next = rest[0]
        if (next) {
          setSelectedId(next.id)
          setDraft(toInput(next))
        } else {
          setSelectedId(null)
          setDraft(blankPreset())
        }
      },
      onError: (err) => {
        toast.error('Не удалось удалить', apiErrorMessage(err))
        setConfirmDelete(false)
      },
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Пресеты оформления субтитров с живым превью на вертикальном кадре."
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={startNew}
          >
            Новый пресет
          </Button>
        }
      />

      <QueryBoundary
        query={presetsQuery}
        skeleton={
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Skeleton className="h-80" />
            <Skeleton className="h-[480px]" />
          </div>
        }
        isEmpty={(data) => data.length === 0}
        empty={
          isNew ? undefined : (
            <Card className="p-10">
              <EmptyState
                icon={Captions}
                title="Пока нет пресетов"
                description="Создайте первый пресет оформления субтитров — настройте шрифт, цвет, обводку и фон."
                action={
                  <Button
                    variant="primary"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={startNew}
                  >
                    Создать первый пресет
                  </Button>
                }
              />
            </Card>
          )
        }
      >
        {(data) => (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* Список пресетов */}
            <div className="space-y-2">
              {data.map((p) => (
                <PresetRow
                  key={p.id}
                  preset={p}
                  active={p.id === selectedId}
                  onClick={() => selectExisting(p)}
                />
              ))}
              {isNew && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-content">
                    <Plus className="h-4 w-4 text-primary" />
                    {draft.name.trim() || 'Новый пресет'}
                  </div>
                  <Badge tone="primary">черновик</Badge>
                </div>
              )}
            </div>

            {/* Редактор + превью */}
            {selectedId === null ? (
              <Card className="p-10">
                <EmptyState
                  icon={Type}
                  title="Выберите пресет"
                  description="Выберите пресет слева или создайте новый, чтобы начать редактирование."
                />
              </Card>
            ) : (
              <PresetEditor
                value={draft}
                onChange={setDraft}
                isNew={isNew}
                dirty={dirty}
                saving={createPreset.isPending || updatePreset.isPending}
                deleting={deletePreset.isPending}
                onSave={handleSave}
                onDelete={() => setConfirmDelete(true)}
              />
            )}
          </div>
        )}
      </QueryBoundary>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Удалить пресет?"
        description={
          original
            ? `Пресет «${original.name}» будет удалён без возможности восстановления.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deletePreset.isPending}
              onClick={handleDelete}
            >
              Удалить
            </Button>
          </>
        }
      >
        <p className="text-sm text-content-muted">
          Действие необратимо. Задачи, которые уже используют этот пресет, не затрагиваются.
        </p>
      </Modal>
    </div>
  )
}

function PresetRow({
  preset,
  active,
  onClick,
}: {
  preset: SubtitlePreset
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition',
        active
          ? 'border-primary/60 bg-primary/10'
          : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full border border-white/20"
            style={{ backgroundColor: preset.color }}
          />
          <span className="truncate text-sm font-medium text-content">{preset.name}</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-content-faint">
          {preset.font} · {preset.size}px · {SUBTITLE_POSITION_LABELS[preset.position]}
          {preset.language ? ` · ${preset.language.toUpperCase()}` : ''}
        </div>
      </div>
      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  )
}
