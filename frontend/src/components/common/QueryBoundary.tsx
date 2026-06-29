import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { apiErrorMessage } from '@/api/http'

interface QueryLike<T> {
  isLoading: boolean
  isError: boolean
  error: unknown
  data: T | undefined
  refetch?: () => void
}

export interface QueryBoundaryProps<T> {
  query: QueryLike<T>
  children: (data: T) => ReactNode
  skeleton?: ReactNode
  isEmpty?: (data: T) => boolean
  empty?: ReactNode
}

/** Унифицированная обработка загрузка/ошибка/пусто для React Query. */
export function QueryBoundary<T>({ query, children, skeleton, isEmpty, empty }: QueryBoundaryProps<T>) {
  if (query.isLoading) {
    return (
      <>
        {skeleton ?? (
          <div className="flex items-center justify-center py-16 text-content-faint">
            <Spinner className="h-6 w-6" />
          </div>
        )}
      </>
    )
  }
  if (query.isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-danger/30 bg-danger/5 py-12 text-center">
        <AlertCircle className="h-8 w-8 text-danger" />
        <div>
          <p className="font-medium text-content">Не удалось загрузить данные</p>
          <p className="mt-1 text-sm text-content-muted">{apiErrorMessage(query.error)}</p>
        </div>
        {query.refetch && (
          <Button variant="secondary" size="sm" onClick={() => query.refetch?.()}>
            Повторить
          </Button>
        )}
      </div>
    )
  }
  if (query.data === undefined) return null
  if (isEmpty && empty && isEmpty(query.data)) return <>{empty}</>
  return <>{children(query.data)}</>
}
