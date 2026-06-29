import { useEffect, useMemo, useState } from 'react'
import { Check, X, Download, Trash2, Minus, Plus, Scissors, Type } from 'lucide-react'
import {
  Modal,
  Button,
  Badge,
  Field,
  Textarea,
  RangeSlider,
  Spinner,
  Tooltip,
  toast,
} from '@/components/ui'
import { ShortStatusBadge } from '@/components/common/badges'
import {
  useShort,
  useApproveShort,
  useRejectShort,
  useDeleteShort,
  usePatchShort,
} from '@/api/hooks'
import { shortFileUrl } from '@/api/endpoints'
import { apiErrorMessage } from '@/api/http'
import { formatDuration, formatTimecode } from '@/lib/format'
import type { SubtitleCue } from '@/types/api'
import { ShortPlayer } from './ShortPlayer'
import { RatingBars } from './RatingBars'
import { MetadataPanel } from './MetadataPanel'

export interface ShortDetailModalProps {
  id: number
  open: boolean
  onClose: () => void
}

const STEP = 0.5

export function ShortDetailModal({ id, open, onClose }: ShortDetailModalProps) {
  const query = useShort(open ? id : 0)
  const short = query.data

  const approve = useApproveShort()
  const reject = useRejectShort()
  const remove = useDeleteShort()
  const patch = usePatchShort()

  // Локальные правки краёв
  const [edge, setEdge] = useState<[number, number] | null>(null)
  // Локальный текст субтитров + локальный оверлей (мгновенное обновление без ре-рендера)
  const [subText, setSubText] = useState('')
  const [localCues, setLocalCues] = useState<SubtitleCue[] | null>(null)

  // Текст субтитров и оверлей синхронизируем только при смене шортса,
  // чтобы фоновый refetch не затирал правки пользователя в textarea.
  useEffect(() => {
    if (!short) return
    setLocalCues(null)
    setSubText((short.subtitles ?? []).map((c) => c.text).join('\n'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [short?.id])

  // Края подтягиваем при смене шортса и после сохранения (когда сервер вернул новые start/end).
  useEffect(() => {
    if (!short) return
    setEdge([short.start_ts, short.end_ts])
  }, [short?.id, short?.start_ts, short?.end_ts])

  const sliderBounds = useMemo(() => {
    if (!short) return { min: 0, max: 1 }
    return { min: Math.max(0, short.start_ts - 10), max: short.end_ts + 10 }
  }, [short?.start_ts, short?.end_ts])

  if (!open) return null

  const edgesDirty =
    !!short && !!edge && (edge[0] !== short.start_ts || edge[1] !== short.end_ts)

  const overlayCues = localCues ?? short?.subtitles

  const clamp = (v: number) => Math.max(0, Math.round(v * 10) / 10)

  function bumpStart(delta: number) {
    setEdge((e) => (e ? [Math.min(clamp(e[0] + delta), e[1] - STEP), e[1]] : e))
  }
  function bumpEnd(delta: number) {
    setEdge((e) => (e ? [e[0], Math.max(clamp(e[1] + delta), e[0] + STEP)] : e))
  }

  function saveEdges() {
    if (!short || !edge) return
    patch.mutate(
      { id: short.id, start_ts: edge[0], end_ts: edge[1] },
      {
        onSuccess: () => toast.success('Края сохранены'),
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  function applySubtitles() {
    if (!short) return
    // Мгновенно обновляем оверлей локально
    const lines = subText.split('\n').filter((l) => l.trim().length > 0)
    setLocalCues(lines.map((text, i) => ({ start: i * 2, end: i * 2 + 2, text })))
    patch.mutate(
      { id: short.id, subtitles_text: subText },
      {
        onSuccess: () => toast.success('Субтитры обновлены'),
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  function doApprove() {
    if (!short) return
    approve.mutate(short.id, {
      onSuccess: () => {
        toast.success('Одобрено', 'Запущен финальный рендер')
        onClose()
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }
  function doReject() {
    if (!short) return
    reject.mutate(short.id, {
      onSuccess: () => {
        toast.success('Шортс отклонён')
        onClose()
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }
  function doDelete() {
    if (!short) return
    if (!window.confirm('Удалить шортс безвозвратно?')) return
    remove.mutate(short.id, {
      onSuccess: () => {
        toast.success('Шортс удалён')
        onClose()
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={short?.hook_title ?? 'Шортс'}
      description={short?.movie_title ?? undefined}
      footer={
        short && (
          <>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 className="h-4 w-4" />}
              loading={remove.isPending}
              onClick={doDelete}
            >
              Удалить
            </Button>
            <div className="flex-1" />
            {short.has_final && (
              <a href={shortFileUrl(short.id)} download>
                <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />}>
                  Скачать
                </Button>
              </a>
            )}
            {short.status !== 'rejected' && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<X className="h-4 w-4" />}
                loading={reject.isPending}
                onClick={doReject}
              >
                Отклонить
              </Button>
            )}
            {short.status === 'draft' && (
              <Button
                size="sm"
                leftIcon={<Check className="h-4 w-4" />}
                loading={approve.isPending}
                onClick={doApprove}
              >
                Одобрить
              </Button>
            )}
          </>
        )
      }
    >
      {query.isLoading || !short ? (
        <div className="flex items-center justify-center py-20 text-content-faint">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,240px)_1fr]">
          {/* Левая колонка: плеер */}
          <div className="space-y-3">
            <ShortPlayer
              id={short.id}
              hasPreview={short.has_preview}
              overall={short.rating.overall}
              subtitles={overlayCues}
            />
            <div className="flex items-center justify-between text-xs text-content-muted">
              <ShortStatusBadge status={short.status} />
              <span>{formatDuration(short.duration)}</span>
            </div>
            <p className="text-center font-mono text-xs text-content-faint">
              {formatTimecode(short.start_ts, true)} – {formatTimecode(short.end_ts, true)}
            </p>
          </div>

          {/* Правая колонка */}
          <div className="space-y-5">
            <RatingBars rating={short.rating} reason={short.reason} />

            {/* Метаданные */}
            <section>
              <h4 className="mb-2 text-sm font-semibold text-content">Метаданные</h4>
              <MetadataPanel metadata={short.metadata} />
            </section>

            {/* Подгонка краёв */}
            <section>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-content">
                <Scissors className="h-4 w-4 text-content-muted" />
                Подгонка краёв
              </h4>
              {edge && (
                <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="mb-1 block text-xs text-content-muted">Начало</span>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="−0.5с" onClick={() => bumpStart(-STEP)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="flex-1 text-center font-mono text-sm text-content">
                          {formatTimecode(edge[0], true)}
                        </span>
                        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="+0.5с" onClick={() => bumpStart(STEP)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <span className="mb-1 block text-xs text-content-muted">Конец</span>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="−0.5с" onClick={() => bumpEnd(-STEP)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="flex-1 text-center font-mono text-sm text-content">
                          {formatTimecode(edge[1], true)}
                        </span>
                        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="+0.5с" onClick={() => bumpEnd(STEP)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <RangeSlider
                    value={edge}
                    onChange={setEdge}
                    min={sliderBounds.min}
                    max={sliderBounds.max}
                    step={0.1}
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-content-faint">
                      Длительность: {formatDuration(edge[1] - edge[0])}
                    </span>
                    <div className="flex items-center gap-2">
                      {edgesDirty && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEdge([short.start_ts, short.end_ts])}
                        >
                          Сбросить
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={!edgesDirty}
                        loading={patch.isPending}
                        onClick={saveEdges}
                      >
                        Сохранить края
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Правка субтитров */}
            <section>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-content">
                <Type className="h-4 w-4 text-content-muted" />
                Субтитры
              </h4>
              <Field hint="Одна реплика на строку. «Применить» сразу обновит оверлей на превью.">
                <Textarea
                  rows={5}
                  value={subText}
                  onChange={(e) => setSubText(e.target.value)}
                  placeholder="Текст субтитров…"
                />
              </Field>
              <div className="mt-2 flex justify-end">
                <Button size="sm" leftIcon={<Type className="h-4 w-4" />} loading={patch.isPending} onClick={applySubtitles}>
                  Применить
                </Button>
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-1.5">
              {short.category && <Badge tone="info">{short.category}</Badge>}
              <Tooltip content="Номер варианта внутри момента">
                <Badge tone="neutral">вариант №{short.variant_no}</Badge>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
