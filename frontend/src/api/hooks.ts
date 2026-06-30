import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './endpoints'
import { qk, type ShortsFilter } from './keys'
import type {
  CategoryInput,
  JobParams,
  ProfileInput,
  ProviderTestRequest,
  SettingsUpdate,
  SubtitlePresetInput,
} from '@/types/api'

// ─── Дашборд ────────────────────────────────────────────────────────────────
export const useHealth = () =>
  useQuery({ queryKey: qk.health, queryFn: api.getHealth, refetchInterval: 15_000 })
export const useUsage = () =>
  useQuery({ queryKey: qk.usage, queryFn: api.getUsage, refetchInterval: 30_000 })
export const useStats = () =>
  useQuery({ queryKey: qk.stats, queryFn: api.getStats, refetchInterval: 30_000 })

// ─── Библиотека ─────────────────────────────────────────────────────────────
export const useMovies = () => useQuery({ queryKey: qk.movies, queryFn: api.getMovies })
export const useMovie = (id: number) =>
  useQuery({ queryKey: qk.movie(id), queryFn: () => api.getMovie(id), enabled: id > 0 })

export function useScanLibrary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.scanLibrary,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.movies }),
  })
}
export function useDeleteMovie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteMovie,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.movies }),
  })
}

// ─── Задачи ─────────────────────────────────────────────────────────────────
const hasActive = (jobs?: { status: string }[]) =>
  !!jobs?.some((j) => j.status === 'running' || j.status === 'queued' || j.status === 'waiting_limit')

export const useJobs = () =>
  useQuery({
    queryKey: qk.jobs,
    queryFn: api.getJobs,
    refetchInterval: (q) => (hasActive(q.state.data as never) ? 2500 : 8000),
  })
export const useJob = (id: number) =>
  useQuery({ queryKey: qk.job(id), queryFn: () => api.getJob(id), enabled: id > 0 })

function invalidateJobs(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: qk.jobs })
}

export function useCreateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: JobParams) => api.createJob(body),
    onSuccess: () => invalidateJobs(qc),
  })
}
export function useCancelJob() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.cancelJob, onSuccess: () => invalidateJobs(qc) })
}
export function useSetJobPriority() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, priority }: { id: number; priority: number }) =>
      api.setJobPriority(id, priority),
    onSuccess: () => invalidateJobs(qc),
  })
}
export function useRepeatJob() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.repeatJob, onSuccess: () => invalidateJobs(qc) })
}
export function useEstimateJob() {
  return useMutation({ mutationFn: (body: JobParams) => api.estimateJob(body) })
}
export function useBatchJobs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.batchJobs(body),
    onSuccess: () => invalidateJobs(qc),
  })
}
export function useDeleteJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, deleteShorts }: { id: number; deleteShorts?: boolean }) =>
      api.deleteJob(id, deleteShorts ?? false),
    onSuccess: () => {
      invalidateJobs(qc)
      qc.invalidateQueries({ queryKey: ['shorts'] })
    },
  })
}
export function useBulkJobs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      ids,
      action,
      deleteShorts,
    }: {
      ids: number[]
      action: 'delete' | 'cancel'
      deleteShorts?: boolean
    }) => api.bulkJobs(ids, action, deleteShorts ?? false),
    onSuccess: () => {
      invalidateJobs(qc)
      qc.invalidateQueries({ queryKey: ['shorts'] })
    },
  })
}

// ─── Шортсы ─────────────────────────────────────────────────────────────────
export const useShorts = (filter?: ShortsFilter) =>
  useQuery({
    queryKey: qk.shorts(filter),
    queryFn: () => api.getShorts(filter),
    refetchInterval: 10_000,
  })
export const useShort = (id: number) =>
  useQuery({ queryKey: qk.short(id), queryFn: () => api.getShort(id), enabled: id > 0 })

function invalidateShorts(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['shorts'] }) // списки
  qc.invalidateQueries({ queryKey: ['short'] }) // открытая деталь (иначе модалка залипает)
  qc.invalidateQueries({ queryKey: qk.stats }) // счётчики дашборда
}

export function useApproveShort() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.approveShort, onSuccess: () => invalidateShorts(qc) })
}
export function useRejectShort() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.rejectShort, onSuccess: () => invalidateShorts(qc) })
}
export function useDeleteShort() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.deleteShort, onSuccess: () => invalidateShorts(qc) })
}
export function usePatchShort() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: number
      start_ts?: number
      end_ts?: number
      subtitles_text?: string
    }) => api.patchShort(id, body),
    onSuccess: (_d, vars) => {
      invalidateShorts(qc)
      qc.invalidateQueries({ queryKey: qk.short(vars.id) })
    },
  })
}
export function useBulkShorts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, action }: { ids: number[]; action: 'approve' | 'reject' | 'delete' }) =>
      api.bulkShorts(ids, action),
    onSuccess: () => invalidateShorts(qc),
  })
}

// ─── Пресеты субтитров ──────────────────────────────────────────────────────
export const usePresets = () => useQuery({ queryKey: qk.presets, queryFn: api.getPresets })
export function useCreatePreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SubtitlePresetInput) => api.createPreset(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.presets }),
  })
}
export function useUpdatePreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: SubtitlePresetInput }) =>
      api.updatePreset(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.presets }),
  })
}
export function useDeletePreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deletePreset,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.presets }),
  })
}

// ─── Профили ────────────────────────────────────────────────────────────────
export const useProfiles = () => useQuery({ queryKey: qk.profiles, queryFn: api.getProfiles })
export function useCreateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ProfileInput) => api.createProfile(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profiles }),
  })
}
export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ProfileInput }) => api.updateProfile(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profiles }),
  })
}
export function useDeleteProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profiles }),
  })
}

// ─── Категории ──────────────────────────────────────────────────────────────
export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: api.getCategories })
export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CategoryInput) => api.createCategory(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.categories }),
  })
}
export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: CategoryInput }) => api.updateCategory(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.categories }),
  })
}
export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.categories }),
  })
}

// ─── Настройки / провайдеры ─────────────────────────────────────────────────
export const useSettings = () => useQuery({ queryKey: qk.settings, queryFn: api.getSettings })
export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SettingsUpdate) => api.updateSettings(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.settings })
      qc.invalidateQueries({ queryKey: qk.health })
      qc.invalidateQueries({ queryKey: qk.usage })
    },
  })
}
export function useTestProvider() {
  return useMutation({ mutationFn: (body: ProviderTestRequest) => api.testProvider(body) })
}
export function useBackup() {
  return useMutation({ mutationFn: api.runBackup })
}
