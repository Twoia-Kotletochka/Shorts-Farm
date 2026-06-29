import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Film, Scissors, Trash2 } from 'lucide-react'
import { Badge, Button, Card, Modal, toast, Tooltip } from '@/components/ui'
import { TranscriptionBadge } from '@/components/common/badges'
import { useDeleteMovie } from '@/api/hooks'
import { apiErrorMessage } from '@/api/http'
import { formatBytes, formatDuration } from '@/lib/format'
import type { Movie } from '@/types/api'

export function MovieRow({ movie }: { movie: Movie }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const del = useDeleteMovie()

  function handleDelete() {
    del.mutate(movie.id, {
      onSuccess: () => {
        toast.success('Фильм удалён', movie.title)
        setConfirmOpen(false)
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }

  const meta: string[] = []
  if (movie.duration != null) meta.push(formatDuration(movie.duration))
  if (movie.width != null && movie.height != null) meta.push(`${movie.width}×${movie.height}`)
  if (movie.fps != null) meta.push(`${Math.round(movie.fps)} fps`)
  if (movie.file_size != null) meta.push(formatBytes(movie.file_size))

  return (
    <Card className="group flex items-center gap-4 p-3 transition-colors hover:border-border-strong">
      {/* Постер-заглушка */}
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-content-faint">
        <Film className="h-6 w-6" />
      </div>

      {/* Текстовый блок */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-content">{movie.title}</span>
          {movie.episode != null && (
            <span className="shrink-0 text-xs text-content-faint">
              S{movie.season ?? 1}·E{movie.episode}
            </span>
          )}
        </div>
        <p className="truncate font-mono text-xs text-content-faint" title={movie.rel_path}>
          {movie.rel_path}
        </p>
        {meta.length > 0 && (
          <p className="mt-1 truncate text-xs text-content-muted">{meta.join(' · ')}</p>
        )}
      </div>

      {/* Статусы */}
      <div className="flex shrink-0 items-center gap-2">
        {movie.status === 'error' && <Badge tone="danger">Ошибка</Badge>}
        <TranscriptionBadge status={movie.transcription_status} />
      </div>

      {/* Действия */}
      <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <Link to={`/create?movie=${movie.id}`}>
          <Button variant="secondary" size="sm" leftIcon={<Scissors className="h-4 w-4" />}>
            Создать шортсы
          </Button>
        </Link>
        <Tooltip content="Удалить из библиотеки">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Удалить"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4 text-content-muted" />
          </Button>
        </Tooltip>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Удалить фильм?"
        description="Запись будет удалена из библиотеки. Файл на диске не затрагивается."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={del.isPending}>
              Отмена
            </Button>
            <Button variant="danger" loading={del.isPending} onClick={handleDelete}>
              Удалить
            </Button>
          </>
        }
      >
        <p className="text-sm text-content-muted">
          <span className="font-medium text-content">{movie.title}</span>
          <br />
          <span className="font-mono text-xs text-content-faint">{movie.rel_path}</span>
        </p>
      </Modal>
    </Card>
  )
}
