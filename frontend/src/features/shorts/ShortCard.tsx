import { Check, X, Download, Trash2, Maximize2 } from 'lucide-react'
import { Button, Checkbox, Badge, Tooltip } from '@/components/ui'
import { ShortStatusBadge } from '@/components/common/badges'
import { ShortPlayer } from './ShortPlayer'
import { shortFileUrl } from '@/api/endpoints'
import { formatDuration, formatTimecode } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ShortListItem } from '@/types/api'

export interface ShortCardProps {
  short: ShortListItem
  selected: boolean
  active: boolean
  pendingApprove: boolean
  pendingReject: boolean
  pendingDelete: boolean
  onToggleSelect: () => void
  onOpen: () => void
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
}

export function ShortCard({
  short,
  selected,
  active,
  pendingApprove,
  pendingReject,
  pendingDelete,
  onToggleSelect,
  onOpen,
  onApprove,
  onReject,
  onDelete,
}: ShortCardProps) {
  return (
    <div
      data-short-id={short.id}
      className={cn(
        'group flex flex-col overflow-hidden rounded-lg border bg-surface shadow-card transition-colors',
        active ? 'border-primary ring-1 ring-primary' : 'border-border',
      )}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full focus:outline-none"
          aria-label="Открыть шортс"
        >
          <ShortPlayer
            id={short.id}
            hasPreview={short.has_preview}
            overall={short.rating.overall}
            className="rounded-none border-0"
          />
        </button>

        {/* Чекбокс выбора */}
        <div
          className={cn(
            'absolute right-2 top-2 rounded-md bg-black/55 p-1 backdrop-blur-sm transition-opacity',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <Checkbox checked={selected} onChange={onToggleSelect} />
        </div>

        {/* Кнопка открыть (на ховер) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="secondary"
            size="sm"
            className="pointer-events-auto"
            leftIcon={<Maximize2 className="h-3.5 w-3.5" />}
            onClick={onOpen}
          >
            Открыть
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-content">
            {short.hook_title ?? 'Без названия'}
          </p>
          <ShortStatusBadge status={short.status} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {short.category && <Badge tone="info">{short.category}</Badge>}
          <Badge tone="neutral">{formatDuration(short.duration)}</Badge>
        </div>

        <p className="font-mono text-xs text-content-faint">
          {formatTimecode(short.start_ts)} – {formatTimecode(short.end_ts)}
        </p>

        {short.movie_title && (
          <p className="truncate text-xs text-content-muted">{short.movie_title}</p>
        )}

        {/* Действия */}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {short.status === 'draft' && (
            <Button
              variant="subtle"
              size="sm"
              loading={pendingApprove}
              leftIcon={<Check className="h-4 w-4" />}
              onClick={onApprove}
            >
              Одобрить
            </Button>
          )}

          {short.status !== 'rejected' && (
            <Tooltip content="Отклонить">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                loading={pendingReject}
                aria-label="Отклонить"
                onClick={onReject}
              >
                <X className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}

          {short.has_final && (
            <Tooltip content="Скачать">
              <a href={shortFileUrl(short.id)} download aria-label="Скачать">
                <Button variant="ghost" size="icon" className="h-8 w-8" type="button">
                  <Download className="h-4 w-4" />
                </Button>
              </a>
            </Tooltip>
          )}

          <Tooltip content="Удалить">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-content-faint hover:text-danger"
              loading={pendingDelete}
              aria-label="Удалить"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
