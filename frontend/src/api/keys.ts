import type { ShortStatus } from '@/types/api'

export interface ShortsFilter {
  status?: ShortStatus
  movie_id?: number
  sort?: string
}

/** Централизованные ключи React Query. */
export const qk = {
  health: ['health'] as const,
  usage: ['usage'] as const,
  stats: ['stats'] as const,
  movies: ['movies'] as const,
  movie: (id: number) => ['movies', id] as const,
  jobs: ['jobs'] as const,
  job: (id: number) => ['jobs', id] as const,
  shorts: (filter?: ShortsFilter) => ['shorts', filter ?? {}] as const,
  short: (id: number) => ['short', id] as const,
  presets: ['subtitle-presets'] as const,
  profiles: ['profiles'] as const,
  categories: ['categories'] as const,
  settings: ['settings'] as const,
}
