import { useNavigate } from 'react-router-dom'
import { History, RotateCcw } from 'lucide-react'
import { useJobs, useRepeatJob } from '@/api/hooks'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Skeleton,
  toast,
} from '@/components/ui'
import { QueryBoundary } from '@/components/common/QueryBoundary'
import { JobStatusBadge } from '@/components/common/badges'
import { apiErrorMessage } from '@/api/http'
import { formatRelative } from '@/lib/format'

export function HistoryList() {
  const jobs = useJobs()
  const repeat = useRepeatJob()
  const navigate = useNavigate()

  const onRepeat = (id: number) => {
    repeat.mutate(id, {
      onSuccess: () => {
        toast.success('Задача поставлена в очередь')
        navigate('/queue')
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }

  return (
    <Card>
      <CardHeader title="Недавние задачи" description="Повторите запуск в один клик" />
      <CardContent className="pt-0">
        <QueryBoundary
          query={jobs}
          skeleton={
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          }
          isEmpty={(data) => data.length === 0}
          empty={
            <EmptyState
              icon={History}
              title="Истории пока нет"
              description="Запущенные задачи появятся здесь."
              className="border-0 py-8"
            />
          }
        >
          {(data) => (
            <ul className="space-y-1.5">
              {data.slice(0, 5).map((j) => (
                <li
                  key={j.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-content">
                      {j.movie_title ?? `Фильм #${j.movie_id}`}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <JobStatusBadge status={j.status} />
                      <span className="truncate text-xs text-content-faint">
                        {formatRelative(j.created_at)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<RotateCcw className="h-4 w-4" />}
                    loading={repeat.isPending && repeat.variables === j.id}
                    onClick={() => onRepeat(j.id)}
                  >
                    Повторить
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  )
}
