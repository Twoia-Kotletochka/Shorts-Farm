import { Tv } from 'lucide-react'
import { Badge } from '@/components/ui'
import { plural } from '@/lib/format'
import { MovieRow } from './MovieRow'
import type { Movie } from '@/types/api'

/** Сортировка эпизодов сериала по сезону/номеру серии. */
function sortEpisodes(a: Movie, b: Movie): number {
  const sa = a.season ?? 0
  const sb = b.season ?? 0
  if (sa !== sb) return sa - sb
  const ea = a.episode ?? 0
  const eb = b.episode ?? 0
  if (ea !== eb) return ea - eb
  return a.title.localeCompare(b.title, 'ru')
}

export function SeriesGroup({ series, episodes }: { series: string; episodes: Movie[] }) {
  const sorted = [...episodes].sort(sortEpisodes)

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Tv className="h-4 w-4 text-content-muted" />
        <h3 className="truncate text-sm font-semibold text-content">{series}</h3>
        <Badge tone="neutral">
          {sorted.length} {plural(sorted.length, 'серия', 'серии', 'серий')}
        </Badge>
      </div>
      <div className="space-y-2">
        {sorted.map((m) => (
          <MovieRow key={m.id} movie={m} />
        ))}
      </div>
    </section>
  )
}
