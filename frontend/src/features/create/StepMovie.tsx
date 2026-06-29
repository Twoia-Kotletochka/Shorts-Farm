import { Link } from 'react-router-dom'
import { Check, Clapperboard, Film, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMovies } from '@/api/hooks'
import { Badge, Button, EmptyState, Input, Skeleton } from '@/components/ui'
import { QueryBoundary } from '@/components/common/QueryBoundary'
import { TranscriptionBadge } from '@/components/common/badges'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Movie } from '@/types/api'

interface StepMovieProps {
  selectedId: number
  onSelect: (id: number) => void
}

export function StepMovie({ selectedId, onSelect }: StepMovieProps) {
  const movies = useMovies()
  const [q, setQ] = useState('')

  return (
    <div className="space-y-4">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Поиск по названию фильма…"
        leftIcon={<Search className="h-4 w-4" />}
      />

      <QueryBoundary
        query={movies}
        skeleton={
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        }
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            icon={Film}
            title="Библиотека пуста"
            description="Добавьте фильмы и просканируйте библиотеку, чтобы начать генерацию."
            action={
              <Link to="/library">
                <Button variant="secondary" size="sm">
                  В библиотеку
                </Button>
              </Link>
            }
          />
        }
      >
        {(data) => <MovieGrid movies={data} q={q} selectedId={selectedId} onSelect={onSelect} />}
      </QueryBoundary>
    </div>
  )
}

function MovieGrid({
  movies,
  q,
  selectedId,
  onSelect,
}: {
  movies: Movie[]
  q: string
  selectedId: number
  onSelect: (id: number) => void
}) {
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return movies
    return movies.filter(
      (m) =>
        m.title.toLowerCase().includes(needle) ||
        (m.series ?? '').toLowerCase().includes(needle),
    )
  }, [movies, q])

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="Ничего не найдено"
        description="Попробуйте изменить запрос."
        className="border-0 py-10"
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {filtered.map((m) => {
        const selected = m.id === selectedId
        const noTranscript = m.transcription_status !== 'done'
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={cn(
              'group flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
              selected
                ? 'border-primary bg-primary/10'
                : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2',
            )}
          >
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                selected ? 'bg-primary text-primary-fg' : 'bg-surface-3 text-content-faint',
              )}
            >
              {selected ? <Check className="h-5 w-5" /> : <Clapperboard className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-content">{m.title}</span>
              <span className="mt-0.5 block truncate text-xs text-content-faint">
                {formatDuration(m.duration)}
                {m.width && m.height ? ` · ${m.width}×${m.height}` : ''}
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                <TranscriptionBadge status={m.transcription_status} />
                {noTranscript && (
                  <Badge tone="info">Транскрипт создастся при генерации</Badge>
                )}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
