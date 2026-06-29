import { useMemo, useState } from 'react'
import { FolderOpen, RefreshCw, Search } from 'lucide-react'
import { useMovies, useScanLibrary } from '@/api/hooks'
import { apiErrorMessage } from '@/api/http'
import { Button, EmptyState, Input, Skeleton, toast } from '@/components/ui'
import { PageHeader } from '@/components/common/PageHeader'
import { QueryBoundary } from '@/components/common/QueryBoundary'
import { plural } from '@/lib/format'
import { MovieRow } from '@/features/library/MovieRow'
import { SeriesGroup } from '@/features/library/SeriesGroup'
import type { Movie } from '@/types/api'

export function LibraryPage() {
  const movies = useMovies()
  const scan = useScanLibrary()
  const [search, setSearch] = useState('')

  function handleScan() {
    scan.mutate(undefined, {
      onSuccess: (res) => {
        const added = res?.added ?? 0
        const total = res?.total ?? 0
        toast.success(
          'Сканирование завершено',
          `${added} ${plural(added, 'новый', 'новых', 'новых')} из ${total}`,
        )
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }

  const scanButton = (
    <Button
      variant="primary"
      loading={scan.isPending}
      leftIcon={<RefreshCw className="h-4 w-4" />}
      onClick={handleScan}
    >
      Пересканировать
    </Button>
  )

  const query = search.trim().toLowerCase()

  const filtered = useMemo<Movie[]>(() => {
    const all = movies.data ?? []
    if (!query) return all
    return all.filter(
      (m) =>
        m.title.toLowerCase().includes(query) ||
        m.rel_path.toLowerCase().includes(query) ||
        (m.series?.toLowerCase().includes(query) ?? false),
    )
  }, [movies.data, query])

  const { groups, standalone } = useMemo(() => {
    const map = new Map<string, Movie[]>()
    const solo: Movie[] = []
    for (const m of filtered) {
      if (m.series != null && m.series !== '') {
        const arr = map.get(m.series)
        if (arr) arr.push(m)
        else map.set(m.series, [m])
      } else {
        solo.push(m)
      }
    }
    solo.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    const seriesList = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'))
    return { groups: seriesList, standalone: solo }
  }, [filtered])

  return (
    <div className="space-y-6">
      <PageHeader
        description="Фильмы и сериалы из рекурсивного сканирования папки sources/ на сервере."
        actions={scanButton}
      />

      <div className="max-w-md">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию или пути…"
          leftIcon={<Search className="h-4 w-4" />}
        />
      </div>

      <QueryBoundary
        query={movies}
        skeleton={
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[74px]" />
            ))}
          </div>
        }
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            icon={FolderOpen}
            title="Библиотека пуста"
            description="Положите видео в папку sources/ на сервере и нажмите «Пересканировать»."
            action={scanButton}
          />
        }
      >
        {() => {
          if (filtered.length === 0) {
            return (
              <EmptyState
                icon={Search}
                title="Ничего не найдено"
                description={`По запросу «${search.trim()}» нет совпадений.`}
                action={
                  <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                    Сбросить поиск
                  </Button>
                }
              />
            )
          }

          return (
            <div className="space-y-8">
              {standalone.length > 0 && (
                <div className="space-y-2">
                  {standalone.map((m) => (
                    <MovieRow key={m.id} movie={m} />
                  ))}
                </div>
              )}

              {groups.map(([series, episodes]) => (
                <SeriesGroup key={series} series={series} episodes={episodes} />
              ))}
            </div>
          )
        }}
      </QueryBoundary>
    </div>
  )
}
