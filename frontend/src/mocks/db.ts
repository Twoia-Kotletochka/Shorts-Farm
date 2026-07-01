/** In-memory stateful store для mock-режима: мутации реально меняют данные. */
import * as fx from './fixtures'
import type { MockShort } from './fixtures'
import type {
  Category,
  CategoryInput,
  Job,
  JobParams,
  Movie,
  Profile,
  ProfileInput,
  ProviderConfig,
  Settings,
  SettingsUpdate,
  ShortDetail,
  ShortListItem,
  SubtitlePreset,
  SubtitlePresetInput,
} from '@/types/api'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

// Изменяемое состояние (копии фикстур)
const movies: Movie[] = clone(fx.movies)
const jobs: Job[] = clone(fx.jobs)
let shorts: MockShort[] = clone(fx.shorts)
let presets: SubtitlePreset[] = clone(fx.subtitlePresets)
let profiles: Profile[] = clone(fx.profiles)
let categories: Category[] = clone(fx.categories)
const settings: Settings = clone(fx.settings)
const jobParams = new Map<number, JobParams>()

let jobSeq = 100
let shortSeq = 1000
let presetSeq = 100
let profileSeq = 100
let categorySeq = 100
let momentSeq = 1000

const nowIso = () => new Date().toISOString()
const titleOf = (id: number) => movies.find((m) => m.id === id)?.title ?? `Фильм #${id}`

// ─── Пайплайн стадий по прогрессу ───────────────────────────────────────────
function stageForProgress(p: number): Job['stage'] {
  if (p < 0.1) return 'probe'
  if (p < 0.2) return 'extract_audio'
  if (p < 0.45) return 'transcribe'
  if (p < 0.5) return 'scene_detect'
  if (p < 0.75) return 'analyze'
  if (p < 0.82) return 'select'
  if (p < 0.95) return 'preview'
  if (p < 1) return 'metadata'
  return 'finished'
}

function makeDraft(job: Job, idx: number, params: JobParams): MockShort {
  const cat = params.categories[idx % Math.max(1, params.categories.length)] ?? null
  const [dmin, dmax] = params.target_duration_sec
  const dur = Math.round(dmin + Math.random() * Math.max(1, dmax - dmin))
  const start = Math.round(300 + Math.random() * 6000)
  const r = () => Math.round(55 + Math.random() * 40) // шкала 0..100
  const overall = r()
  shortSeq += 1
  momentSeq += 1
  return {
    id: shortSeq,
    job_id: job.id,
    movie_id: job.movie_id,
    movie_title: titleOf(job.movie_id),
    moment_id: `m-${momentSeq}`,
    variant_no: 1,
    status: 'draft',
    category: cat,
    hook_title: `Момент ${idx + 1}: ${cat ?? 'сцена'}`,
    rating: {
      overall,
      retention: r(),
      emotion: r(),
      dynamics: r(),
      virality: r(),
    },
    reason: 'Кандидат отобран по тексту, аудио-энергии и сцене — высокий совокупный балл.',
    duration: dur,
    start_ts: start,
    end_ts: start + dur,
    preview_path: `shorts/${titleOf(job.movie_id)}/${job.id}_${idx}_preview.mp4`,
    file_path: null,
    metadata: {
      title: `${titleOf(job.movie_id)} — яркий момент`,
      description: 'Авто-сгенерированное описание. #кино #shorts',
      hashtags: ['#кино', '#shorts', '#нарезка'],
      first_comment: 'Понравилось? Сохраняй, чтобы не потерять.',
    },
    subtitles: [
      { start: 0, end: 2, text: 'Смотри до конца…' },
      { start: 2, end: 4, text: 'этот момент стоит того.' },
    ],
    created_at: nowIso(),
  }
}

/** Продвигает выполняющиеся задачи и запускает очередь (имитация воркера, concurrency=2). */
export function tickJobs() {
  for (const j of jobs) {
    if (j.status === 'running') {
      j.progress = Math.min(1, j.progress + 0.05 + Math.random() * 0.04)
      j.stage = stageForProgress(j.progress)
      if (j.progress >= 1) {
        j.status = 'done'
        j.stage = 'finished'
        j.finished_at = nowIso()
        const params = jobParams.get(j.id)
        const count = params?.count ?? 3
        for (let i = 0; i < count; i++) {
          if (params) shorts.unshift(makeDraft(j, i, params))
        }
      }
    }
  }
  let running = jobs.filter((j) => j.status === 'running').length
  const queue = jobs
    .filter((j) => j.status === 'queued')
    .sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at))
  for (const j of queue) {
    if (running >= 2) break
    j.status = 'running'
    j.stage = 'probe'
    j.progress = 0.03
    j.started_at = nowIso()
    running += 1
  }
}

// ─── Movies ─────────────────────────────────────────────────────────────────
export const listMovies = () => clone(movies)
export const getMovie = (id: number) => clone(movies.find((m) => m.id === id))
export function scanLibrary() {
  // имитация: «находим» один новый файл
  const id = Math.max(0, ...movies.map((m) => m.id)) + 1
  movies.push({
    id,
    title: `Во все тяжкие — S01E0${id}`,
    rel_path: `Сериалы/Во все тяжкие/Сезон 1/S01E0${id}.mkv`,
    series: 'Во все тяжкие',
    season: 1,
    episode: id,
    duration: 2700 + id * 10,
    width: 1920,
    height: 1080,
    fps: 25,
    file_size: 3_000_000_000,
    status: 'new',
    transcription_status: 'none',
    added_at: nowIso(),
  })
  return { added: 1, total: movies.length }
}
export function removeMovie(id: number) {
  const i = movies.findIndex((m) => m.id === id)
  if (i >= 0) movies.splice(i, 1)
}

// ─── Jobs ───────────────────────────────────────────────────────────────────
export function listJobs(): Job[] {
  tickJobs()
  return clone(jobs)
}
export const getJob = (id: number) => clone(jobs.find((j) => j.id === id))
export function createJob(params: JobParams): number {
  jobSeq += 1
  const job: Job = {
    id: jobSeq,
    movie_id: params.movie_id,
    movie_title: titleOf(params.movie_id),
    type: 'generate',
    status: 'queued',
    stage: null,
    progress: 0,
    priority: params.priority ?? 5,
    error: null,
    created_at: nowIso(),
  }
  jobs.unshift(job)
  jobParams.set(job.id, params)
  tickJobs()
  return job.id
}
export function cancelJob(id: number) {
  const j = jobs.find((x) => x.id === id)
  if (j && (j.status === 'queued' || j.status === 'running' || j.status === 'waiting_limit')) {
    j.status = 'canceled'
    j.finished_at = nowIso()
  }
}
export function setPriority(id: number, priority: number) {
  const j = jobs.find((x) => x.id === id)
  if (j) j.priority = priority
}
export function repeatJob(id: number): number {
  const params = jobParams.get(id)
  if (params) return createJob({ ...params })
  const src = jobs.find((j) => j.id === id)
  return createJob({
    movie_id: src?.movie_id ?? movies[0]!.id,
    categories: ['Эмоциональные сцены'],
    count: 3,
    format: 'single',
    subtitles: true,
    effects: { mirror: false, enhance: true, zoom: false },
    reframe: 'smartcrop',
    target_duration_sec: [15, 40],
    language: 'ru',
  })
}
export function batchJobs(body: {
  series?: string
  season?: number
  movie_ids?: number[]
  [k: string]: unknown
}): number[] {
  let targets: Movie[] = []
  if (body.movie_ids?.length) {
    targets = movies.filter((m) => body.movie_ids!.includes(m.id))
  } else if (body.series) {
    targets = movies.filter(
      (m) => m.series === body.series && (body.season == null || m.season === body.season),
    )
  }
  const { series: _s, season: _se, movie_ids: _m, ...rest } = body
  return targets.map((m) => createJob({ ...(rest as object), movie_id: m.id } as JobParams))
}

// ─── Shorts ─────────────────────────────────────────────────────────────────
function toListItem(s: MockShort): ShortListItem {
  return {
    id: s.id,
    job_id: s.job_id,
    movie_id: s.movie_id,
    moment_id: s.moment_id,
    variant_no: s.variant_no,
    status: s.status,
    category: s.category,
    hook_title: s.hook_title,
    rating: s.rating,
    reason: s.reason,
    duration: s.duration,
    start_ts: s.start_ts,
    end_ts: s.end_ts,
    has_preview: !!s.preview_path,
    has_final: !!s.file_path,
    rev: s.rev ?? 1,
    created_at: s.created_at,
    movie_title: s.movie_title,
  }
}

/** Имитация асинхронных рендеров: ре-рендер превью после PATCH и финал после approve. */
function tickShorts() {
  const now = Date.now()
  for (const s of shorts) {
    if (s.rerender_at && now >= s.rerender_at) {
      s.rev = (s.rev ?? 1) + 1
      s.rerender_at = undefined
    }
    if (s.finalize_at && now >= s.finalize_at) {
      s.file_path = s.preview_path?.replace('_preview', '_final') ?? `shorts/final_${s.id}.mp4`
      s.rev = (s.rev ?? 1) + 1
      s.finalize_at = undefined
    }
  }
}
export function listShorts(filter?: {
  status?: string
  movie_id?: number
  sort?: string
}): ShortListItem[] {
  tickJobs()
  tickShorts()
  let list = shorts.slice()
  if (filter?.status) list = list.filter((s) => s.status === filter.status)
  if (filter?.movie_id != null) list = list.filter((s) => s.movie_id === Number(filter.movie_id))
  if (filter?.sort === 'rating') list.sort((a, b) => b.rating.overall - a.rating.overall)
  else list.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return list.map(toListItem)
}
export function getShort(id: number): ShortDetail | undefined {
  tickShorts()
  const s = shorts.find((x) => x.id === id)
  if (!s) return undefined
  return { ...toListItem(s), metadata: s.metadata, subtitles: s.subtitles }
}
export const getShortMetadata = (id: number) => shorts.find((s) => s.id === id)?.metadata
export const getShortSubtitles = (id: number) => shorts.find((s) => s.id === id)?.subtitles ?? []
export function approveShort(id: number) {
  const s = shorts.find((x) => x.id === id)
  if (s) {
    s.status = 'approved'
    s.file_path = null // финал ещё не готов — имитируем рендер
    s.finalize_at = Date.now() + 6000
    if (s.metadata.render_error) s.metadata.render_error = null // повтор — сброс ошибки
  }
}
export function rejectShort(id: number) {
  const s = shorts.find((x) => x.id === id)
  if (s) s.status = 'rejected'
}
export function removeShort(id: number) {
  shorts = shorts.filter((s) => s.id !== id)
}
export function patchShort(
  id: number,
  body: { start_ts?: number; end_ts?: number; subtitles_text?: string },
) {
  const s = shorts.find((x) => x.id === id)
  if (!s) return
  if (body.start_ts != null) s.start_ts = body.start_ts
  if (body.end_ts != null) s.end_ts = body.end_ts
  if (body.start_ts != null || body.end_ts != null) s.duration = Math.round(s.end_ts - s.start_ts)
  if (body.subtitles_text != null) {
    const lines = body.subtitles_text.split('\n').filter(Boolean)
    s.subtitles = lines.map((text, i) => ({ start: i * 2, end: i * 2 + 2, text }))
  }
  s.rerender_at = Date.now() + 3000 // имитация пере-рендера превью (rev вырастет)
}
export function bulkShorts(ids: number[], action: 'approve' | 'reject' | 'delete') {
  if (action === 'delete') {
    shorts = shorts.filter((s) => !ids.includes(s.id))
    return
  }
  ids.forEach((id) => (action === 'approve' ? approveShort(id) : rejectShort(id)))
}

// ─── Presets ────────────────────────────────────────────────────────────────
export const listPresets = () => clone(presets)
export function createPreset(body: SubtitlePresetInput): SubtitlePreset {
  presetSeq += 1
  const p = { id: presetSeq, ...body }
  presets.push(p)
  return clone(p)
}
export function updatePreset(id: number, body: SubtitlePresetInput): SubtitlePreset | undefined {
  const i = presets.findIndex((p) => p.id === id)
  if (i < 0) return undefined
  presets[i] = { id, ...body }
  return clone(presets[i])
}
export function deletePreset(id: number) {
  presets = presets.filter((p) => p.id !== id)
}

// ─── Profiles ───────────────────────────────────────────────────────────────
export const listProfiles = () => clone(profiles)
export function createProfile(body: ProfileInput): Profile {
  profileSeq += 1
  const p = { id: profileSeq, ...body }
  profiles.push(p)
  return clone(p)
}
export function updateProfile(id: number, body: ProfileInput): Profile | undefined {
  const i = profiles.findIndex((p) => p.id === id)
  if (i < 0) return undefined
  profiles[i] = { id, ...body }
  return clone(profiles[i])
}
export function deleteProfile(id: number) {
  profiles = profiles.filter((p) => p.id !== id)
}

// ─── Categories ─────────────────────────────────────────────────────────────
export const listCategories = () => clone(categories)
export function createCategory(body: CategoryInput): Category {
  categorySeq += 1
  const c = { id: categorySeq, ...body }
  categories.push(c)
  return clone(c)
}
export function updateCategory(id: number, body: CategoryInput): Category | undefined {
  const i = categories.findIndex((c) => c.id === id)
  if (i < 0) return undefined
  categories[i] = { id, ...body }
  return clone(categories[i])
}
export function deleteCategory(id: number) {
  categories = categories.filter((c) => c.id !== id)
}

// ─── Settings ───────────────────────────────────────────────────────────────
const MASK = '****' // как у бэкенда ("****abcd"), чтобы совпадал с MASKED_RE формы провайдера
function maskKey(v?: string | null): string | null {
  if (!v) return v ?? null
  return MASK + v.slice(-4)
}
export function getSettings(): Settings {
  const s = clone(settings)
  s.llm_provider.api_key = maskKey(settings.llm_provider.api_key)
  s.stt_provider.api_key = maskKey(settings.stt_provider.api_key)
  s.llm_providers = settings.llm_providers.map(maskProvider)
  s.stt_providers = settings.stt_providers.map(maskProvider)
  s.panel_password_set = !!settings.panel_password
  s.panel_password = undefined // сам пароль наружу не отдаём
  return s
}
function isMasked(v?: string | null) {
  return !v || v.includes('*')
}
/** Маска провайдера для GET: секретны и api_key, и значения extra_headers. */
function maskProvider(p: ProviderConfig): ProviderConfig {
  const out: ProviderConfig = { ...p, api_key: maskKey(p.api_key) }
  const mh = maskHeaders(p.extra_headers)
  if (mh) out.extra_headers = mh
  else delete out.extra_headers
  return out
}
function maskHeaders(h?: Record<string, string> | null): Record<string, string> | undefined {
  if (!h || Object.keys(h).length === 0) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(h)) out[k] = maskKey(v) ?? ''
  return out
}

/**
 * Слить входящие extra_headers с прежними по имени: маска/пусто → прежнее значение.
 * `undefined` (ключ отсутствует в payload) → не трогать; `{}` → очистить.
 */
function mergeHeaders(
  prev: Record<string, string> | undefined,
  incoming: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (incoming === undefined) return prev
  const prevMap = prev ?? {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(incoming)) {
    out[k] = isMasked(v) ? (prevMap[k] ?? '') : v
  }
  return out
}

/** Слить входящий список провайдеров с существующим по id: маскированный/пустой ключ → сохранить прежний. */
function mergeProviderList(
  existing: ProviderConfig[],
  incoming: ProviderConfig[],
): ProviderConfig[] {
  const byId = new Map(existing.filter((p) => p.id).map((p) => [p.id, p]))
  return incoming.map((p) => {
    const id = p.id ?? 'mock-' + Math.random().toString(36).slice(2, 8)
    const prev = byId.get(id)
    const key = !p.api_key || isMasked(p.api_key) ? (prev?.api_key ?? '') : p.api_key
    const merged: ProviderConfig = { ...p, id, api_key: key }
    const mh = mergeHeaders(prev?.extra_headers, p.extra_headers)
    if (mh === undefined) delete merged.extra_headers
    else merged.extra_headers = mh
    return merged
  })
}
export function updateSettings(body: SettingsUpdate): Settings {
  if (body.llm_provider) {
    const incoming = body.llm_provider
    const key = isMasked(incoming.api_key) ? settings.llm_provider.api_key : incoming.api_key
    settings.llm_provider = { ...settings.llm_provider, ...incoming, api_key: key }
  }
  if (body.stt_provider) {
    const incoming = body.stt_provider
    const key = isMasked(incoming.api_key) ? settings.stt_provider.api_key : incoming.api_key
    settings.stt_provider = { ...settings.stt_provider, ...incoming, api_key: key }
  }
  if (body.llm_providers) {
    settings.llm_providers = mergeProviderList(settings.llm_providers, body.llm_providers)
    const first = settings.llm_providers[0]
    if (first) settings.llm_provider = { ...first }
  }
  if (body.stt_providers) {
    settings.stt_providers = mergeProviderList(settings.stt_providers, body.stt_providers)
    const first = settings.stt_providers[0]
    if (first) settings.stt_provider = { ...first }
  }
  if (body.render) settings.render = { ...settings.render, ...body.render }
  if (body.backup) settings.backup = { ...settings.backup, ...body.backup }
  if (body.default_language !== undefined) settings.default_language = body.default_language
  if (body.retention_days !== undefined) settings.retention_days = body.retention_days
  if (body.panel_password !== undefined) settings.panel_password = body.panel_password
  return getSettings()
}

// ─── Dashboard ──────────────────────────────────────────────────────────────
export const getUsage = () => clone(fx.usage)
export function getStats() {
  const generated = shorts.length
  const approved = shorts.filter((s) => s.status === 'approved').length
  return { generated: Math.max(fx.stats.generated, generated), approved: Math.max(fx.stats.approved, approved) }
}
export function getHealth() {
  const hasLlm = !isMasked(settings.llm_provider.api_key) || settings.llm_provider.type === 'ollama'
  const hasStt = !isMasked(settings.stt_provider.api_key) || settings.stt_provider.type === 'ollama'
  return { api: true, redis: true, worker: true, llm_provider: hasLlm, stt_provider: hasStt }
}

export function exportConfig() {
  return {
    settings: getSettings(),
    subtitle_presets: presets,
    profiles,
    categories,
    exported_at: nowIso(),
  }
}
