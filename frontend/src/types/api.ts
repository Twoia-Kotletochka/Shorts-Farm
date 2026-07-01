/**
 * Типы контракта API (фронт ↔ бэк) — зеркало Pydantic-схем бэкенда.
 * Поля на проводе — snake_case (как отдаёт FastAPI), поэтому здесь тоже snake_case.
 * Источник правды: prompt/01_общая_спецификация.md + app/models бэкенда.
 */

// ─── Перечисления статусов (хранятся строками) ──────────────────────────────
export const MOVIE_STATUSES = ['new', 'error'] as const
export type MovieStatus = (typeof MOVIE_STATUSES)[number]

export const TRANSCRIPTION_STATUSES = ['none', 'pending', 'done', 'error'] as const
export type TranscriptionStatus = (typeof TRANSCRIPTION_STATUSES)[number]

export const JOB_STATUSES = [
  'queued',
  'running',
  'waiting_limit',
  'done',
  'failed',
  'canceled',
] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const JOB_STAGES = [
  'probe',
  'extract_audio',
  'transcribe',
  'scene_detect',
  'analyze',
  'select',
  'preview',
  'awaiting_approval',
  'render',
  'metadata',
  'finished',
] as const
export type JobStage = (typeof JOB_STAGES)[number]

export const SHORT_STATUSES = ['draft', 'approved', 'rejected'] as const
export type ShortStatus = (typeof SHORT_STATUSES)[number]

export const PROVIDER_TYPES = ['groq', 'openrouter', 'ollama', 'openai'] as const
export type ProviderType = (typeof PROVIDER_TYPES)[number]

export const REFRAME_MODES = ['smartcrop', 'blurpad'] as const
export type ReframeMode = (typeof REFRAME_MODES)[number]

export const SHORT_FORMATS = ['single', 'compilation'] as const
export type ShortFormat = (typeof SHORT_FORMATS)[number]

export const SUBTITLE_POSITIONS = ['top', 'center', 'bottom'] as const
export type SubtitlePosition = (typeof SUBTITLE_POSITIONS)[number]

// ─── Библиотека / фильмы ────────────────────────────────────────────────────
export interface AudioTrack {
  index: number // относительный индекс среди аудио (для -map 0:a:N)
  stream_index?: number | null
  language: string | null
  title: string | null
  channels: number | null
  codec: string | null
  default: boolean
}

export interface Movie {
  id: number
  title: string
  rel_path: string
  series: string | null
  season: number | null
  episode: number | null
  duration: number | null // секунды
  width: number | null
  height: number | null
  fps: number | null
  file_size?: number | null // байты
  status?: MovieStatus // в списке (MovieOut) не приходит — только в деталях
  transcription_status: TranscriptionStatus
  audio_tracks?: AudioTrack[]
  added_at: string // ISO datetime
  metadata?: Record<string, unknown>
}

// ─── Транскрипты ────────────────────────────────────────────────────────────
export interface TranscriptWord {
  word: string
  start: number
  end: number
}
export interface TranscriptSegment {
  start: number
  end: number
  text: string
  words?: TranscriptWord[]
}

// ─── Задачи генерации ───────────────────────────────────────────────────────
export interface JobEffects {
  mirror: boolean
  enhance: boolean
  zoom: boolean
}

/** Тело POST /api/jobs (оно же params_json для «повторить»). */
export interface JobParams {
  movie_id: number
  categories: string[]
  count: number
  format: ShortFormat
  subtitles: boolean
  subtitle_preset_id?: number | null
  subtitle_language?: string | null
  effects: JobEffects
  reframe: ReframeMode
  target_duration_sec: [number, number] // длина клипа (для format=single)
  // Для format=compilation: длина каждого момента и общий бюджет монтажа (иначе — дефолты бэкенда).
  compilation_segment_sec?: [number, number] | null // деф. [6,12]
  compilation_total_sec?: number | null // деф. 60
  language: string
  audio_track?: number | string | null // index дорожки ИЛИ код языка ("rus"); null/опустить → авто
  allow_duplicates?: boolean
  profile_id?: number | null
  priority?: number
}

export interface Job {
  id: number
  movie_id: number
  type: string
  status: JobStatus
  stage: JobStage | null
  progress: number // 0..1
  priority: number // 0..9
  error: string | null
  created_at: string
  started_at?: string | null
  finished_at?: string | null
  // Удобные подмешанные поля (бэкенд может отдавать в списке):
  movie_title?: string
  params?: JobParams
}

/** POST /api/jobs/estimate. */
export interface JobEstimate {
  whisper_audio_sec_needed?: number
  fits_today?: boolean
  unlimited?: boolean // провайдер без квот
}

// ─── Шортсы ─────────────────────────────────────────────────────────────────
export interface ShortRating {
  overall: number
  retention: number
  emotion: number
  dynamics: number
  virality: number
}

export interface ShortMetadata {
  title: string
  description: string
  hashtags: string[]
  first_comment: string
  variants?: string[]
  /** Причина падения финального рендера (если был). Показываем на approved-без-final. */
  render_error?: string | null
}

export interface SubtitleCue {
  start: number
  end: number
  text: string
}

/** Элемент списка GET /api/shorts. */
export interface ShortListItem {
  id: number
  job_id: number | null
  movie_id: number
  moment_id: string | null
  variant_no: number
  status: ShortStatus
  category: string | null
  hook_title: string | null
  rating: ShortRating
  reason: string | null
  duration: number | null
  start_ts: number
  end_ts: number
  has_preview: boolean
  has_final: boolean
  /** Версия файлов (mtime). Добавлять к URL медиа как ?v=rev для сброса кэша после ре-рендера. */
  rev: number
  created_at: string
  movie_title?: string
}

/** Детали GET /api/shorts/{id}. */
export interface ShortDetail extends ShortListItem {
  metadata: ShortMetadata
  subtitles?: SubtitleCue[]
}

// ─── Пресеты субтитров ──────────────────────────────────────────────────────
export interface SubtitleStyle {
  /** safe-area: держать текст вне зон интерфейса TikTok/YouTube */
  safe_area?: boolean
  /** караоке-подсветка по словам */
  karaoke?: boolean
  bold?: boolean
  italic?: boolean
  /** толщина обводки, px */
  outline_width?: number
  /** прозрачность плашки фона 0..1 */
  background_opacity?: number
  [key: string]: unknown
}

export interface SubtitlePreset {
  id: number
  name: string
  font: string
  size: number
  color: string // hex
  outline: string // hex
  background: string | null // hex | null
  position: SubtitlePosition
  style_json: SubtitleStyle
  language: string | null
}
export type SubtitlePresetInput = Omit<SubtitlePreset, 'id'>

// ─── Профили генерации ──────────────────────────────────────────────────────
export interface Profile {
  id: number
  name: string
  params_json: Partial<JobParams>
}
export type ProfileInput = Omit<Profile, 'id'>

// ─── Категории ──────────────────────────────────────────────────────────────
export interface Category {
  id: number
  name: string
  hint: string | null
}
export type CategoryInput = Omit<Category, 'id'>

// ─── Настройки / провайдеры ─────────────────────────────────────────────────
export interface ProviderConfig {
  /** Стабильный id провайдера в приоритетном списке — для сохранения ключа при правке. */
  id?: string
  type: ProviderType
  base_url?: string | null
  api_key?: string | null // в ответах GET маскируется ("****abcd")
  model: string
  model_fast?: string | null // только LLM (двухпроходный анализ)
  // Балансир: упорядоченные списки моделей (failover на 402/403/429). Пусто → одиночные model/model_fast.
  models?: string[] | null
  models_fast?: string[] | null
}

export interface RenderSettings {
  preset: string // libx264 preset
  reframe: ReframeMode
  duration_range: [number, number]
  trim_silence: boolean
  encoder?: string // "auto" | "libx264"
}

export interface BackupSettings {
  enabled: boolean
  period: string // "daily" | ...
}

export interface Settings {
  // Приоритетные СПИСКИ провайдеров (index 0 = высший; фейловер вниз по списку).
  llm_providers: ProviderConfig[]
  stt_providers: ProviderConfig[]
  // Legacy-одиночные (зеркало первого элемента списка) — бэкенд ещё отдаёт для совместимости.
  llm_provider: ProviderConfig
  stt_provider: ProviderConfig
  /** GET возвращает только факт наличия пароля (сам пароль не отдаётся). */
  panel_password_set: boolean
  /** Только для PUT: новый пароль (или null — снять). В ответе GET отсутствует. */
  panel_password?: string | null
  default_language: string
  render: RenderSettings
  retention_days: number
  backup: BackupSettings
}

/** Тело PUT /api/settings (частичное обновление). */
export type SettingsUpdate = Partial<Settings>

/** POST /api/providers/test. */
export interface ProviderTestRequest {
  kind: 'llm' | 'stt'
  config: ProviderConfig
}
export interface ProviderTestResult {
  ok: boolean
  error?: string | null
}

// ─── Дашборд ────────────────────────────────────────────────────────────────
export interface UsageProvider {
  provider: string
  has_limits: boolean
  used?: number
  limit?: number
  available: boolean
  balance?: number | string | null
}
export interface Usage {
  llm: UsageProvider
  stt: UsageProvider
  disk: { free_gb: number; total_gb: number }
}

export interface Stats {
  generated: number
  approved: number
}

// ─── Авторизация (опц. пароль панели) ───────────────────────────────────────
export interface AuthStatus {
  password_required: boolean
}

export type HealthFlag = boolean | string // bool | "not_configured"
export interface Health {
  api: boolean
  redis: boolean
  worker: boolean
  llm_provider: HealthFlag
  stt_provider: HealthFlag
}

// ─── Общие ответы ───────────────────────────────────────────────────────────
export interface ScanResult {
  added: number
  total: number
}
export interface BulkShortsRequest {
  ids: number[]
  action: 'approve' | 'reject' | 'delete'
}
export interface BackupResult {
  ok: boolean
  file: string
}

/** Шкала рейтинга на проводе: 0..100 (подтверждено бэкендом — pipeline/select). */
export const RATING_SCALE = 100
