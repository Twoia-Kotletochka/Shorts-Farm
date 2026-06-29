import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks, Plus } from 'lucide-react'
import { useJobs } from '@/api/hooks'
import { Button, EmptyState, Skeleton, Tabs } from '@/components/ui'
import type { TabItem } from '@/components/ui'
import { PageHeader } from '@/components/common/PageHeader'
import { QueryBoundary } from '@/components/common/QueryBoundary'
import type { Job, JobStatus } from '@/types/api'
import { JobCard } from '@/features/queue/JobCard'

type Filter = 'all' | 'active' | 'done' | 'errors'

const ACTIVE: JobStatus[] = ['running', 'queued', 'waiting_limit']
const ERRORS: JobStatus[] = ['failed', 'canceled']

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
    // Активные ожидающие — по приоритету (выше приоритет — выше в списке).
    const aActive = ACTIVE.includes(a.status)
    if (aActive && a.priority !== b.priority) return b.priority - a.priority
    // Завершённые — по дате (свежие сверху).
    const ta = Date.parse(a.finished_at ?? a.created_at) || 0
    const tb = Date.parse(b.finished_at ?? b.created_at) || 0
    return tb - ta
  })
}

export function QueuePage() {
  const jobs = useJobs()
  const [filter, setFilter] = useState<Filter>('all')

  const counts = useMemo(() => {
    const list = jobs.data ?? []
    return {
      all: list.length,
      active: list.filter((j) => ACTIVE.includes(j.status)).length,
      done: list.filter((j) => j.status === 'done').length,
      errors: list.filter((j) => ERRORS.includes(j.status)).length,
    }
  }, [jobs.data])

  const tabs: TabItem<Filter>[] = [
    { value: 'all', label: 'Все', count: counts.all },
    { value: 'active', label: 'Активные', count: counts.active },
    { value: 'done', label: 'Готовые', count: counts.done },
    { value: 'errors', label: 'Ошибки', count: counts.errors },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        description="Задачи генерации шортсов: прогресс по стадиям пайплайна, приоритеты и ошибки."
        actions={
          <Link to="/create">
            <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
              Новая задача
            </Button>
          </Link>
        }
      />

      <Tabs items={tabs} value={filter} onChange={setFilter} />

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
        {(data) => {
          const filtered = sortJobs(data.filter((j) => matchesFilter(j, filter)))
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
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )
        }}
      </QueryBoundary>
    </div>
  )
}
