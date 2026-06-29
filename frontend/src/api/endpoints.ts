import { http, mediaUrl } from './http'
import type { ShortsFilter } from './keys'
import type {
  BackupResult,
  Category,
  CategoryInput,
  Health,
  Job,
  JobEstimate,
  JobParams,
  Movie,
  Profile,
  ProfileInput,
  ProviderTestRequest,
  ProviderTestResult,
  ScanResult,
  Settings,
  SettingsUpdate,
  ShortDetail,
  ShortListItem,
  ShortMetadata,
  SubtitleCue,
  SubtitlePreset,
  SubtitlePresetInput,
  Stats,
  Usage,
} from '@/types/api'

// ─── Дашборд ────────────────────────────────────────────────────────────────
export const getHealth = () => http.get<Health>('/health').then((r) => r.data)
export const getUsage = () => http.get<Usage>('/usage').then((r) => r.data)
export const getStats = () => http.get<Stats>('/stats').then((r) => r.data)

// ─── Библиотека / фильмы ────────────────────────────────────────────────────
export const scanLibrary = () => http.post<ScanResult>('/library/scan').then((r) => r.data)
export const getMovies = () => http.get<Movie[]>('/movies').then((r) => r.data)
export const getMovie = (id: number) => http.get<Movie>(`/movies/${id}`).then((r) => r.data)
export const deleteMovie = (id: number) => http.delete(`/movies/${id}`).then((r) => r.data)

// ─── Задачи ─────────────────────────────────────────────────────────────────
export const createJob = (body: JobParams) =>
  http.post<{ job_id: number }>('/jobs', body).then((r) => r.data)
export const getJobs = () => http.get<Job[]>('/jobs').then((r) => r.data)
export const getJob = (id: number) => http.get<Job>(`/jobs/${id}`).then((r) => r.data)
export const cancelJob = (id: number) => http.post(`/jobs/${id}/cancel`).then((r) => r.data)
export const setJobPriority = (id: number, priority: number) =>
  http.patch(`/jobs/${id}/priority`, { priority }).then((r) => r.data)
export const repeatJob = (id: number) =>
  http.post<{ job_id: number }>(`/jobs/${id}/repeat`).then((r) => r.data)
export const estimateJob = (body: JobParams) =>
  http.post<JobEstimate>('/jobs/estimate', body).then((r) => r.data)
export const batchJobs = (body: Record<string, unknown>) =>
  http.post<{ job_ids: number[] }>('/jobs/batch', body).then((r) => r.data)

// ─── Шортсы ─────────────────────────────────────────────────────────────────
export const getShorts = (filter?: ShortsFilter) =>
  http.get<ShortListItem[]>('/shorts', { params: filter }).then((r) => r.data)
export const getShort = (id: number) => http.get<ShortDetail>(`/shorts/${id}`).then((r) => r.data)
export const getShortMetadata = (id: number) =>
  http.get<ShortMetadata>(`/shorts/${id}/metadata`).then((r) => r.data)
export const getShortSubtitles = (id: number) =>
  http.get<SubtitleCue[]>(`/shorts/${id}/subtitles`).then((r) => r.data)
export const approveShort = (id: number) => http.post(`/shorts/${id}/approve`).then((r) => r.data)
export const rejectShort = (id: number) => http.post(`/shorts/${id}/reject`).then((r) => r.data)
export const deleteShort = (id: number) => http.delete(`/shorts/${id}`).then((r) => r.data)
export const patchShort = (
  id: number,
  body: { start_ts?: number; end_ts?: number; subtitles_text?: string },
) => http.patch(`/shorts/${id}`, body).then((r) => r.data)
export const bulkShorts = (ids: number[], action: 'approve' | 'reject' | 'delete') =>
  http.post('/shorts/bulk', { ids, action }).then((r) => r.data)

/** URL-ы медиа (для <video>/<img>/скачивания). */
export const shortPreviewUrl = (id: number) => mediaUrl(`/shorts/${id}/preview`)
export const shortFileUrl = (id: number) => mediaUrl(`/shorts/${id}/file`)
export const shortThumbUrl = (id: number) => mediaUrl(`/shorts/${id}/thumbnail`)

// ─── Пресеты субтитров ──────────────────────────────────────────────────────
export const getPresets = () => http.get<SubtitlePreset[]>('/subtitle-presets').then((r) => r.data)
export const createPreset = (body: SubtitlePresetInput) =>
  http.post<SubtitlePreset>('/subtitle-presets', body).then((r) => r.data)
export const updatePreset = (id: number, body: SubtitlePresetInput) =>
  http.put<SubtitlePreset>(`/subtitle-presets/${id}`, body).then((r) => r.data)
export const deletePreset = (id: number) =>
  http.delete(`/subtitle-presets/${id}`).then((r) => r.data)

// ─── Профили ────────────────────────────────────────────────────────────────
export const getProfiles = () => http.get<Profile[]>('/profiles').then((r) => r.data)
export const createProfile = (body: ProfileInput) =>
  http.post<Profile>('/profiles', body).then((r) => r.data)
export const updateProfile = (id: number, body: ProfileInput) =>
  http.put<Profile>(`/profiles/${id}`, body).then((r) => r.data)
export const deleteProfile = (id: number) => http.delete(`/profiles/${id}`).then((r) => r.data)

// ─── Категории ──────────────────────────────────────────────────────────────
export const getCategories = () => http.get<Category[]>('/categories').then((r) => r.data)
export const createCategory = (body: CategoryInput) =>
  http.post<Category>('/categories', body).then((r) => r.data)
export const updateCategory = (id: number, body: CategoryInput) =>
  http.put<Category>(`/categories/${id}`, body).then((r) => r.data)
export const deleteCategory = (id: number) => http.delete(`/categories/${id}`).then((r) => r.data)

// ─── Настройки / провайдеры ─────────────────────────────────────────────────
export const getSettings = () => http.get<Settings>('/settings').then((r) => r.data)
export const updateSettings = (body: SettingsUpdate) =>
  http.put<Settings>('/settings', body).then((r) => r.data)
export const testProvider = (body: ProviderTestRequest) =>
  http.post<ProviderTestResult>('/providers/test', body).then((r) => r.data)

// ─── Бэкап / конфиг ─────────────────────────────────────────────────────────
export const runBackup = () => http.post<BackupResult>('/backup').then((r) => r.data)
export const exportConfig = () => http.get('/config/export').then((r) => r.data)
export const importConfig = (json: unknown) =>
  http.post('/config/import', json).then((r) => r.data)
