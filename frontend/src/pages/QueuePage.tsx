import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks, Plus, Trash2, X } from 'lucide-react'
import { useBulkJobs, useJobs, useShorts } from '@/api/hooks'
import { Button, Checkbox, EmptyState, Modal, Skeleton, Tabs, toast } from '@/components/ui'
import type { TabItem } from '@/components/ui'
import { PageHeader } from '@/components/common/PageHeader'
import { QueryBoundary } from '@/components/common/QueryBoundary'
import { apiErrorMessage } from '@/api/http'
import type { Job, JobStatus } from '@/types/api'
import { JobCard } from '@/features/queue/JobCard'

type Filter = 'all' | 'active' | 'done' | 'errors'

const ACTIVE: JobStatus[] = ['running', 'queued', 'waiting_limit']
const ERRORS: JobStatus[] = ['failed', 'canceled']
const TERMINAL: JobStatus[] = ['done', 'failed', 'canceled']

function matchesFilter(job: Job, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'active':
      return ACTIVE.includes(job.status)
    case 'done':
      return job.status === 'done'
    case 'errors':
      return ERRORS.includes(job.status)
  }
}

// Порядок активных: running → waiting_limit → queued. Внутри — по убыванию приоритета.
const STATUS_RANK: Record<JobStatus, number> = {
  running: 0,
  waiting_limit: 1,
  queued: 2,
  done: 3,
  failed: 4,
  canceled: 5,
}

function sortJobs(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    const ra = STATUS_RANK[a.status]
    const rb = STATUS_RANK[b.status]
    if (ra !== rb) return ra - rb
    const aActive = ACTIVE.includes(a.status)
    if (aActive && a.priority !== b.priority) return b.priority - a.priority
    const ta = Date.parse(a.finished_at ?? a.created_at) || 0
    const tb = Date.parse(b.finished_at ?? b.created_at) || 0
    return tb - ta
  })
}

export function QueuePage() {
  const jobs = useJobs()
  const shorts = useShorts()
  const bulk = useBulkJobs()

  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [bulkDelShorts, setBulkDelShorts] = useState(false)

  const allJobs = jobs.data ?? []

  // Кол-во готовых роликов на каждую задачу (для чекбокса «удалить и ролики»).
  const shortsCount = useMemo(() => {
    const m = new Map<number, number>()
    for (const s of shorts.data ?? []) {
      if (s.job_id != null) m.set(s.job_id, (m.get(s.job_id) ?? 0) + 1)
    }
    return m
  }, [shorts.data])

  // Убираем из выбора исчезнувшие задачи.
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(allJobs.map((j) => j.id))
      let changed = false
      const next = new Set<number>()
      prev.forEach((id) => {
        if (ids.has(id)) next.add(id)
        else changed = true
      })
      return changed ? next : prev
    })
  }, [allJobs])

  const counts = useMemo(() => {
    return {
      all: allJobs.length,
      active: allJobs.filter((j) => ACTIVE.includes(j.status)).length,
      done: allJobs.filter((j) => j.status === 'done').length,
      errors: allJobs.filter((j) => ERRORS.includes(j.status)).length,
    }
  }, [allJobs])

  const tabs: TabItem<Filter>[] = [
    { value: 'all', label: 'Все', count: counts.all },
    { value: 'active', label: 'Активные', count: counts.active },
    { value: 'done', label: 'Готовые', count: counts.done },
    { value: 'errors', label: 'Ошибки', count: counts.errors },
  ]

  // Видимый (отфильтрованный + отсортированный) список — для сетки и «выбрать все».
  const visible = useMemo(
    () => sortJobs(allJobs.filter((j) => matchesFilter(j, filter))),
    [allJobs, filter],
  )
  const visibleIds = visible.map((j) => j.id)
  const selectedVisible = visibleIds.filter((id) => selected.has(id)).length
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible === visibleIds.length
  const someVisibleSelected = selectedVisible > 0 && !allVisibleSelected
  function toggleSelectAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) visibleIds.forEach((id) => next.add(id))
      else visibleIds.forEach((id) => next.delete(id))
      return next
    })
  }

  const terminalCount = allJobs.filter((j) => TERMINAL.includes(j.status)).length
  const selectedIds = Array.from(selected)
  const selectedHaveShorts = selectedIds.some((id) => (shortsCount.get(id) ?? 0) > 0)

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function runBulkDelete() {
    bulk.mutate(
      { ids: selectedIds, action: 'delete', deleteShorts: bulkDelShorts },
      {
        onSuccess: (res) => {
          toast.success('Задачи удалены', `Затронуто: ${res.affected}`)
          setSelected(new Set())
          setConfirmBulk(false)
          setBulkDelShorts(false)
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  function runClearFinished() {
    const ids = allJobs.filter((j) => TERMINAL.includes(j.status)).map((j) => j.id)
    // Чистим только записи; готовые ролики сохраняем (delete_shorts=false).
    bulk.mutate(
      { ids, action: 'delete', deleteShorts: false },
      {
        onSuccess: (res) => {
          toast.success('Очищено', `Удалено задач: ${res.affected}. Готовые ролики сохранены.`)
          setConfirmClear(false)
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Задачи генерации шортсов: прогресс по стадиям пайплайна, приоритеты и ошибки."
        actions={
          <div className="flex items-center gap-2">
            {terminalCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Trash2 className="h-4 w-4" />}
                onClick={() => setConfirmClear(true)}
              >
                Очистить завершённые ({terminalCount})
              </Button>
            )}
            <Link to="/create">
              <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                Новая задача
              </Button>
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs items={tabs} value={filter} onChange={setFilter} />
          {visible.length > 0 && (
            <Checkbox
              checked={allVisibleSelected}
              indeterminate={someVisibleSelected}
              onChange={toggleSelectAll}
              label={`Выбрать все (${visible.length})`}
            />
          )}
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 animate-fade-in">
            <span className="text-sm text-content-muted">Выбрано: {selected.size}</span>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="h-4 w-4" />}
              onClick={() => {
                setBulkDelShorts(false)
                setConfirmBulk(true)
              }}
            >
              Удалить выбранные
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<X className="h-4 w-4" />}
              onClick={() => setSelected(new Set())}
            >
              Снять
            </Button>
          </div>
        )}
      </div>

      <QueryBoundary
        query={jobs}
        skeleton={
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        }
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            icon={ListChecks}
            title="Очередь пуста"
            description="Здесь появятся задачи генерации. Создайте первую на вкладке «Создание шортсов»."
            action={
              <Link to="/create">
                <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                  Создать задачу
                </Button>
              </Link>
            }
          />
        }
      >
        {() => {
          const filtered = visible
          if (filtered.length === 0) {
            return (
              <EmptyState
                icon={ListChecks}
                title="Нет задач в этой категории"
                description="Смените фильтр, чтобы увидеть остальные задачи."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setFilter('all')}>
                    Показать все
                  </Button>
                }
              />
            )
          }
          return (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {filtered.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  selected={selected.has(job.id)}
                  onToggleSelect={() => toggleSelect(job.id)}
                  shortsCount={shortsCount.get(job.id) ?? 0}
                />
              ))}
            </div>
          )
        }}
      </QueryBoundary>

      {/* Очистить завершённые/упавшие */}
      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Очистить завершённые и упавшие?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Назад
            </Button>
            <Button variant="danger" loading={bulk.isPending} onClick={runClearFinished}>
              Очистить ({terminalCount})
            </Button>
          </>
        }
      >
        <p className="text-sm text-content-muted">
          Удалит {terminalCount} завершённых, отменённых и упавших задач из списка.{' '}
          <span className="font-medium text-content">Готовые ролики сохранятся</span> в «Готовых».
        </p>
      </Modal>

      {/* Массовое удаление выбранных */}
      <Modal
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        title={`Удалить выбранные задачи (${selected.size})?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmBulk(false)}>
              Назад
            </Button>
            <Button variant="danger" loading={bulk.isPending} onClick={runBulkDelete}>
              Удалить
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-content-muted">
          <p>Активные среди выбранных будут сначала отменены.</p>
          {selectedHaveShorts ? (
            <Checkbox
              checked={bulkDelShorts}
              onChange={setBulkDelShorts}
              label="Также удалить готовые ролики этих задач (вместе с файлами)"
            />
          ) : (
            <p>Готовые ролики не затрагиваются.</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
