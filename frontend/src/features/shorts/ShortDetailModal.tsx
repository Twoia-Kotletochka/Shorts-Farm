import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  X,
  Download,
  Trash2,
  Minus,
  Plus,
  Scissors,
  Type,
  TriangleAlert,
  RotateCcw,
} from 'lucide-react'
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

  const [edge, setEdge] = useState<[number, number] | null>(null)
  const [subText, setSubText] = useState('')
  const [initialSub, setInitialSub] = useState('')
  // rev, зафиксированный перед PATCH: ждём, пока бэкенд пере-рендерит превью (rev вырастет).
  const [baseRev, setBaseRev] = useState<number | null>(null)
  const [finalStart, setFinalStart] = useState<number | null>(null)

  const renderError = short?.metadata?.render_error ?? null
  const rerendering = baseRev != null && short != null && short.rev <= baseRev
  const renderingFinal = short?.status === 'approved' && !short?.has_final && !renderError
  // Фолбэк: если финал рендерится подозрительно долго (>5 мин) — возможно, упал, а бэкенд не отдал
  // render_error. Не залипаем в вечном спиннере: показываем «Повторить» и прекращаем поллинг.
  const renderStalled =
    renderingFinal && finalStart != null && Date.now() - finalStart > 300_000
  const needPoll = open && !!short && (rerendering || (renderingFinal && !renderStalled))

  // Текст субтитров / края подтягиваем при смене шортса (фоновый refetch не затирает правки).
  useEffect(() => {
    if (!short) return
    const txt = (short.subtitles ?? []).map((c) => c.text).join('\n')
    setSubText(txt)
    setInitialSub(txt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [short?.id])

  useEffect(() => {
    if (!short) return
    setEdge([short.start_ts, short.end_ts])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [short?.id, short?.start_ts, short?.end_ts])

  // Как только rev вырос — ре-рендер завершён.
  useEffect(() => {
    if (baseRev != null && short && short.rev > baseRev) setBaseRev(null)
  }, [short?.rev, baseRev])

  // Засекаем старт финального рендера (для фолбэка по таймауту).
  useEffect(() => {
    if (renderingFinal && finalStart == null) setFinalStart(Date.now())
    if (!renderingFinal && finalStart != null) setFinalStart(null)
  }, [renderingFinal, finalStart])

  // Страховка: если rev так и не вырос (ре-рендер завис/без изменений) — разблокируем правку через 90с.
  useEffect(() => {
    if (baseRev == null) return
    const t = setTimeout(() => setBaseRev(null), 90_000)
    return () => clearTimeout(t)
  }, [baseRev])

  // Ручной поллинг во время ре-рендера превью / рендера финала.
  const refetchRef = useRef(query.refetch)
  refetchRef.current = query.refetch
  useEffect(() => {
    if (!needPoll) return
    const t = setInterval(() => void refetchRef.current(), 2000)
    return () => clearInterval(t)
  }, [needPoll])

  const sliderBounds = useMemo(() => {
    if (!short) return { min: 0, max: 1 }
    return { min: Math.max(0, short.start_ts - 10), max: short.end_ts + 10 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [short?.start_ts, short?.end_ts])

  if (!open) return null

  const edgesDirty = !!short && !!edge && (edge[0] !== short.start_ts || edge[1] !== short.end_ts)
  const subDirty = subText !== initialSub
  const canEdit = short?.status === 'draft' && !rerendering

  const clamp = (v: number) => Math.max(0, Math.round(v * 10) / 10)
  const bumpStart = (d: number) =>
    setEdge((e) => (e ? [Math.min(clamp(e[0] + d), e[1] - STEP), e[1]] : e))
  const bumpEnd = (d: number) =>
    setEdge((e) => (e ? [e[0], Math.max(clamp(e[1] + d), e[0] + STEP)] : e))

  function saveEdges() {
    if (!short || !edge) return
    const round1 = (v: number) => Math.round(v * 10) / 10
    patch.mutate(
      { id: short.id, start_ts: round1(edge[0]), end_ts: round1(edge[1]) },
      {
        onSuccess: () => {
          setBaseRev(short.rev) // ждём пере-рендера превью
          toast.success('Края сохранены', 'Превью пере-рендерится…')
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  function applySubtitles() {
    if (!short) return
    patch.mutate(
      { id: short.id, subtitles_text: subText },
      {
        onSuccess: () => {
          setBaseRev(short.rev)
          setInitialSub(subText)
          toast.success('Субтитры обновлены', 'Превью пере-рендерится…')
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  function doApprove() {
    if (!short) return
    approve.mutate(short.id, {
      onSuccess: () => toast.success('Одобрено', 'Запущен финальный рендер'),
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }
  function doRetry() {
    if (!short) return
    approve.mutate(short.id, {
      onSuccess: () => toast.success('Рендер перезапущен'),
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

            {renderingFinal && !renderStalled && (
              <span className="flex items-center gap-2 px-1 text-sm text-content-muted">
                <Spinner className="h-4 w-4" />
                Рендерим финал…
              </span>
            )}
            {short.status === 'approved' && short.has_final && (
              <a href={shortFileUrl(short.id, short.rev)} download>
                <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />}>
                  Скачать
                </Button>
              </a>
            )}
            {short.status === 'approved' && (renderError || renderStalled) && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RotateCcw className="h-4 w-4" />}
                loading={approve.isPending}
                onClick={doRetry}
              >
                Повторить рендер
              </Button>
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
                disabled={rerendering}
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
              rev={short.rev}
              overall={short.rating.overall}
              busy={rerendering}
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
            {/* Ошибка финального рендера */}
            {short.status === 'approved' && renderError && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-danger">Финальный рендер не удался</p>
                  <p className="mt-0.5 break-words text-xs text-danger/90">{renderError}</p>
                </div>
              </div>
            )}
            {short.status === 'approved' && renderStalled && !renderError && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Финальный рендер идёт дольше обычного. Подождите ещё или нажмите «Повторить рендер».
                </span>
              </div>
            )}

            <RatingBars rating={short.rating} reason={short.reason} />

            {/* Метаданные */}
            <section>
              <h4 className="mb-2 text-sm font-semibold text-content">Метаданные</h4>
              <MetadataPanel metadata={short.metadata} />
            </section>

            {/* Редактирование доступно только для черновика */}
            {canEdit ? (
              <>
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
                            <Button variant="ghost" size="sm" onClick={() => setEdge([short.start_ts, short.end_ts])}>
                              Сбросить
                            </Button>
                          )}
                          <Button size="sm" disabled={!edgesDirty} loading={patch.isPending} onClick={saveEdges}>
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
                  <Field hint="Одна реплика на строку. После «Применить» превью пере-рендерится с новым текстом.">
                    <Textarea
                      rows={5}
                      value={subText}
                      onChange={(e) => setSubText(e.target.value)}
                      placeholder="Текст субтитров…"
                    />
                  </Field>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" leftIcon={<Type className="h-4 w-4" />} disabled={!subDirty} loading={patch.isPending} onClick={applySubtitles}>
                      Применить
                    </Button>
                  </div>
                </section>
              </>
            ) : (
              short.status === 'approved' && (
                <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-content-faint">
                  Шортс одобрен — правка краёв и субтитров недоступна. Чтобы переделать, отклоните и
                  сгенерируйте заново.
                </p>
              )
            )}

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
