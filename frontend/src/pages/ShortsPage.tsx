import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Clapperboard,
  Film,
  ArrowDownWideNarrow,
  Keyboard,
  LayoutGrid,
  FileEdit,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import {
  useShorts,
  useMovies,
  useApproveShort,
  useRejectShort,
  useDeleteShort,
  useBulkShorts,
} from '@/api/hooks'
import type { ShortsFilter } from '@/api/keys'
import { apiErrorMessage } from '@/api/http'
import {
  Button,
  Checkbox,
  Select,
  Tabs,
  Skeleton,
  EmptyState,
  Tooltip,
  toast,
} from '@/components/ui'
import type { TabItem } from '@/components/ui'
import { PageHeader } from '@/components/common/PageHeader'
import { QueryBoundary } from '@/components/common/QueryBoundary'
import { useHotkeys } from '@/lib/hotkeys'
import { plural } from '@/lib/format'
import type { ShortListItem, ShortStatus } from '@/types/api'
import { ShortCard } from '@/features/shorts/ShortCard'
import { ShortDetailModal } from '@/features/shorts/ShortDetailModal'
import { BulkBar } from '@/features/shorts/BulkBar'

type StatusTab = 'all' | ShortStatus
type SortKey = 'rating' | 'date'

const HOTKEYS_HINT = [
  ['J / K', 'перемещение курсора'],
  ['A', 'одобрить активную'],
  ['R', 'отклонить активную'],
  ['X', 'выбрать / снять выбор'],
] as const

export function ShortsPage() {
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const [sort, setSort] = useState<SortKey>('rating')
  const [movieId, setMovieId] = useState<number | 'all'>('all')

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [cursor, setCursor] = useState<number>(-1)
  const [openId, setOpenId] = useState<number | null>(null)

  const filter: ShortsFilter = useMemo(
    () => ({
      ...(statusTab !== 'all' ? { status: statusTab } : {}),
      ...(movieId !== 'all' ? { movie_id: movieId } : {}),
      sort: sort === 'rating' ? 'rating' : 'date',
    }),
    [statusTab, movieId, sort],
  )

  const shortsQuery = useShorts(filter)
  const moviesQuery = useMovies()

  const approve = useApproveShort()
  const reject = useRejectShort()
  const remove = useDeleteShort()
  const bulk = useBulkShorts()

  const items = shortsQuery.data ?? []

  // Счётчики по статусам (для табов) — берём из текущей выборки только при «Все».
  // Чтобы счётчики были стабильны, считаем по полному набору без фильтра статуса.
  const allForCounts = useShorts(
    useMemo(
      () => ({ ...(movieId !== 'all' ? { movie_id: movieId } : {}), sort: 'date' }),
      [movieId],
    ),
  )
  const counts = useMemo(() => {
    const data = allForCounts.data ?? []
    return {
      all: data.length,
      draft: data.filter((s) => s.status === 'draft').length,
      approved: data.filter((s) => s.status === 'approved').length,
      rejected: data.filter((s) => s.status === 'rejected').length,
    }
  }, [allForCounts.data])

  // Сброс курсора при смене выборки
  useEffect(() => {
    setCursor((c) => (c >= items.length ? items.length - 1 : c))
  }, [items.length])

  // Убираем из выбора пропавшие id
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(items.map((s) => s.id))
      let changed = false
      const next = new Set<number>()
      prev.forEach((id) => {
        if (ids.has(id)) next.add(id)
        else changed = true
      })
      return changed ? next : prev
    })
  }, [items])

  const activeShort: ShortListItem | undefined = cursor >= 0 ? items[cursor] : undefined

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Выбрать все видимые на странице.
  const visibleIds = items.map((s) => s.id)
  const selectedVisible = visibleIds.filter((id) => selected.has(id)).length
  const allSelected = visibleIds.length > 0 && selectedVisible === visibleIds.length
  const someSelected = selectedVisible > 0 && !allSelected
  function toggleSelectAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) visibleIds.forEach((id) => next.add(id))
      else visibleIds.forEach((id) => next.delete(id))
      return next
    })
  }

  function approveOne(s: ShortListItem) {
    approve.mutate(s.id, {
      onSuccess: () => toast.success('Одобрено', s.hook_title ?? undefined),
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }
  function rejectOne(s: ShortListItem) {
    reject.mutate(s.id, {
      onSuccess: () => toast.success('Отклонено', s.hook_title ?? undefined),
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }
  function deleteOne(s: ShortListItem) {
    if (!window.confirm('Удалить шортс безвозвратно?')) return
    remove.mutate(s.id, {
      onSuccess: () => toast.success('Шортс удалён'),
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }

  function runBulk(action: 'approve' | 'reject' | 'delete') {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (action === 'delete' && !window.confirm(`Удалить ${ids.length} шортс(ов) безвозвратно?`)) return
    bulk.mutate(
      { ids, action },
      {
        onSuccess: () => {
          const verb =
            action === 'approve' ? 'одобрено' : action === 'reject' ? 'отклонено' : 'удалено'
          toast.success(`Готово`, `${ids.length} ${plural(ids.length, 'шортс', 'шортса', 'шортсов')} ${verb}`)
          setSelected(new Set())
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  // Хоткеи (отключены, пока открыта модалка)
  useHotkeys(
    {
      j: () => setCursor((c) => Math.min((c < 0 ? -1 : c) + 1, items.length - 1)),
      k: () => setCursor((c) => Math.max((c < 0 ? items.length : c) - 1, 0)),
      a: () => {
        if (activeShort && activeShort.status === 'draft') approveOne(activeShort)
      },
      r: () => {
        if (activeShort && activeShort.status !== 'rejected') rejectOne(activeShort)
      },
      x: () => {
        if (activeShort) toggleSelect(activeShort.id)
      },
    },
    openId === null,
  )

  // Прокрутка к активной карточке
  useEffect(() => {
    if (cursor < 0) return
    const id = items[cursor]?.id
    if (id == null) return
    const el = document.querySelector(`[data-short-id="${id}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [cursor, items])

  const statusTabs: TabItem<StatusTab>[] = [
    { value: 'all', label: 'Все', icon: <LayoutGrid className="h-4 w-4" />, count: counts.all },
    { value: 'draft', label: 'Черновики', icon: <FileEdit className="h-4 w-4" />, count: counts.draft },
    { value: 'approved', label: 'Одобрено', icon: <CheckCircle2 className="h-4 w-4" />, count: counts.approved },
    { value: 'rejected', label: 'Отклонено', icon: <XCircle className="h-4 w-4" />, count: counts.rejected },
  ]

  const movies = moviesQuery.data ?? []

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        description="Отбирайте и редактируйте сгенерированные вертикальные шортсы перед публикацией."
        actions={
          <Tooltip
            side="bottom"
            content={
              <div className="space-y-0.5 text-left">
                {HOTKEYS_HINT.map(([key, desc]) => (
                  <div key={key} className="flex items-center gap-2">
                    <kbd className="rounded bg-surface-3 px-1 font-mono text-[10px] text-content">{key}</kbd>
                    <span className="text-content-muted">{desc}</span>
                  </div>
                ))}
              </div>
            }
          >
            <Button variant="ghost" size="sm" leftIcon={<Keyboard className="h-4 w-4" />}>
              Хоткеи
            </Button>
          </Tooltip>
        }
      />

      {/* Панель фильтров */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs items={statusTabs} value={statusTab} onChange={setStatusTab} />

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Film className="h-4 w-4 text-content-faint" />
            <Select
              className="h-9 min-w-[180px]"
              value={movieId === 'all' ? 'all' : String(movieId)}
              onChange={(e) => setMovieId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              aria-label="Фильтр по фильму"
            >
              <option value="all">Все фильмы</option>
              {movies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <ArrowDownWideNarrow className="h-4 w-4 text-content-faint" />
            <Select
              className="h-9 min-w-[150px]"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Сортировка"
            >
              <option value="rating">По рейтингу</option>
              <option value="date">По дате</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Выбрать все на странице */}
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={toggleSelectAll}
            label={`Выбрать все на странице (${items.length})`}
          />
          {selected.size > 0 && (
            <span className="text-sm text-content-faint">выбрано: {selected.size}</span>
          )}
        </div>
      )}

      {/* Сетка */}
      <QueryBoundary
        query={shortsQuery}
        skeleton={
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[9/16] w-full" />
            ))}
          </div>
        }
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState
            icon={Clapperboard}
            title="Шортсов пока нет"
            description={
              statusTab === 'all' && movieId === 'all'
                ? 'Запустите генерацию, чтобы появились готовые шортсы для отбора.'
                : 'По выбранным фильтрам ничего не найдено.'
            }
            action={
              statusTab === 'all' && movieId === 'all' ? (
                <Link to="/create">
                  <Button variant="primary" size="sm" leftIcon={<Clapperboard className="h-4 w-4" />}>
                    Создать шортсы
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setStatusTab('all')
                    setMovieId('all')
                  }}
                >
                  Сбросить фильтры
                </Button>
              )
            }
          />
        }
      >
        {(data) => (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {data.map((short, idx) => (
              <ShortCard
                key={short.id}
                short={short}
                selected={selected.has(short.id)}
                active={idx === cursor}
                pendingApprove={approve.isPending && approve.variables === short.id}
                pendingReject={reject.isPending && reject.variables === short.id}
                pendingDelete={remove.isPending && remove.variables === short.id}
                onToggleSelect={() => toggleSelect(short.id)}
                onOpen={() => {
                  setCursor(idx)
                  setOpenId(short.id)
                }}
                onApprove={() => approveOne(short)}
                onReject={() => rejectOne(short)}
                onDelete={() => deleteOne(short)}
              />
            ))}
          </div>
        )}
      </QueryBoundary>

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          pending={bulk.isPending}
          onApprove={() => runBulk('approve')}
          onReject={() => runBulk('reject')}
          onDelete={() => runBulk('delete')}
          onClear={() => setSelected(new Set())}
        />
      )}

      {openId !== null && (
        <ShortDetailModal id={openId} open={openId !== null} onClose={() => setOpenId(null)} />
      )}
    </div>
  )
}
