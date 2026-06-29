import { Check, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { plural } from '@/lib/format'

export interface BulkBarProps {
  count: number
  pending: boolean
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
  onClear: () => void
}

/** Нижняя «липкая» панель массовых действий над выбранными шортсами. */
export function BulkBar({ count, pending, onApprove, onReject, onDelete, onClear }: BulkBarProps) {
  return (
    <div className="sticky bottom-4 z-30 mx-auto w-fit max-w-full animate-slide-up">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-strong bg-bg-elev px-3 py-2 shadow-pop">
        <span className="px-1 text-sm text-content">
          Выбрано <span className="font-semibold">{count}</span>{' '}
          {plural(count, 'шортс', 'шортса', 'шортсов')}
        </span>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          variant="subtle"
          size="sm"
          loading={pending}
          leftIcon={<Check className="h-4 w-4" />}
          onClick={onApprove}
        >
          Одобрить
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          leftIcon={<X className="h-4 w-4" />}
          onClick={onReject}
        >
          Отклонить
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          leftIcon={<Trash2 className="h-4 w-4" />}
          onClick={onDelete}
        >
          Удалить
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={onClear}>
          Снять выбор
        </Button>
      </div>
    </div>
  )
}
