import { Link } from 'react-router-dom'
import { ListChecks } from 'lucide-react'
import { Card, CardHeader, CardContent, Progress, EmptyState, Button } from '@/components/ui'
import { JobStatusBadge } from '@/components/common/badges'
import { JOB_STAGE_LABELS } from '@/lib/labels'
import type { Job } from '@/types/api'

export function ActiveJobs({ jobs }: { jobs: Job[] }) {
  const active = jobs.filter(
    (j) => j.status === 'running' || j.status === 'queued' || j.status === 'waiting_limit',
  )

  return (
    <Card>
      <CardHeader
        title="Активные задачи"
        actions={
          <Link to="/queue">
            <Button variant="ghost" size="sm">
              Вся очередь
            </Button>
          </Link>
        }
      />
      <CardContent className="pt-0">
        {active.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Очередь пуста"
            description="Создайте задачу генерации на вкладке «Создание шортсов»."
            className="border-0 py-8"
          />
        ) : (
          <ul className="space-y-3">
            {active.map((j) => (
              <li key={j.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-content">
                    {j.movie_title ?? `Фильм #${j.movie_id}`}
                  </span>
                  <JobStatusBadge status={j.status} />
                </div>
                <Progress
                  value={j.progress}
                  tone={j.status === 'waiting_limit' ? 'warning' : 'primary'}
                />
                <div className="flex justify-between text-xs text-content-faint">
                  <span>{j.stage ? JOB_STAGE_LABELS[j.stage] : 'ожидание'}</span>
                  <span>{Math.round(j.progress * 100)}%</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
