/** Сид-данные для mock-режима (MSW). Русскоязычные, чтобы панель выглядела живой. */
import type {
  Category,
  Job,
  Movie,
  Profile,
  Settings,
  ShortMetadata,
  ShortRating,
  Stats,
  SubtitleCue,
  SubtitlePreset,
  Usage,
} from '@/types/api'

export interface MockShort {
  id: number
  job_id: number | null
  movie_id: number
  movie_title: string
  moment_id: string | null
  variant_no: number
  status: 'draft' | 'approved' | 'rejected'
  category: string | null
  hook_title: string | null
  rating: ShortRating
  reason: string | null
  duration: number | null
  start_ts: number
  end_ts: number
  preview_path: string | null
  file_path: string | null
  metadata: ShortMetadata
  subtitles: SubtitleCue[]
  created_at: string
}

const now = Date.now()
const ago = (min: number) => new Date(now - min * 60_000).toISOString()

export const movies: Movie[] = [
  {
    id: 1,
    title: 'Начало',
    rel_path: 'Фильмы/Начало (2010)/Inception.2010.1080p.mkv',
    series: null,
    season: null,
    episode: null,
    duration: 8880,
    width: 1920,
    height: 1080,
    fps: 23.976,
    file_size: 14_800_000_000,
    status: 'new',
    transcription_status: 'done',
    added_at: ago(60 * 26),
  },
  {
    id: 2,
    title: 'Интерстеллар',
    rel_path: 'Фильмы/Интерстеллар (2014)/Interstellar.2014.2160p.mkv',
    series: null,
    season: null,
    episode: null,
    duration: 10_140,
    width: 3840,
    height: 2160,
    fps: 23.976,
    file_size: 38_200_000_000,
    status: 'new',
    transcription_status: 'done',
    added_at: ago(60 * 20),
  },
  {
    id: 3,
    title: 'Во все тяжкие — S01E01 «Пилот»',
    rel_path: 'Сериалы/Во все тяжкие/Сезон 1/S01E01.mkv',
    series: 'Во все тяжкие',
    season: 1,
    episode: 1,
    duration: 2820,
    width: 1920,
    height: 1080,
    fps: 25,
    file_size: 3_100_000_000,
    status: 'new',
    transcription_status: 'none',
    added_at: ago(60 * 5),
  },
  {
    id: 4,
    title: 'Во все тяжкие — S01E02 «Кошка в мешке»',
    rel_path: 'Сериалы/Во все тяжкие/Сезон 1/S01E02.mkv',
    series: 'Во все тяжкие',
    season: 1,
    episode: 2,
    duration: 2760,
    width: 1920,
    height: 1080,
    fps: 25,
    file_size: 3_050_000_000,
    status: 'new',
    transcription_status: 'pending',
    added_at: ago(60 * 5),
  },
  {
    id: 5,
    title: 'Джокер',
    rel_path: 'Фильмы/Джокер (2019)/Joker.2019.1080p.mkv',
    series: null,
    season: null,
    episode: null,
    duration: 7320,
    width: 1920,
    height: 1080,
    fps: 24,
    file_size: 12_400_000_000,
    status: 'error',
    transcription_status: 'error',
    added_at: ago(60 * 48),
  },
]

export const categories: Category[] = [
  { id: 1, name: 'Юмор / смешные моменты', hint: 'Шутки, панчлайны, комичные ситуации.' },
  { id: 2, name: 'Экшен / динамика', hint: 'Драки, погони, перестрелки, динамичные сцены.' },
  { id: 3, name: 'Эмоциональные сцены', hint: 'Драма, трогательные и сильные моменты.' },
  { id: 4, name: 'Сюжетные твисты', hint: 'Неожиданные повороты, раскрытия, развязки.' },
  { id: 5, name: 'Цитаты и панчлайны', hint: 'Запоминающиеся реплики, афоризмы.' },
  { id: 6, name: 'Напряжение / саспенс', hint: 'Нагнетание, клиффхэнгеры.' },
  { id: 7, name: 'Романтика', hint: 'Романтические сцены, химия персонажей.' },
  { id: 8, name: '«Вау»-моменты', hint: 'Визуально эффектные, зрелищные кадры.' },
]

export const subtitlePresets: SubtitlePreset[] = [
  {
    id: 1,
    name: 'TikTok Drama',
    font: 'Montserrat',
    size: 54,
    color: '#FFFFFF',
    outline: '#000000',
    background: null,
    position: 'bottom',
    style_json: { safe_area: true, karaoke: true, bold: true, outline_width: 3 },
    language: 'ru',
  },
  {
    id: 2,
    name: 'Минимал',
    font: 'Inter',
    size: 46,
    color: '#FFFFFF',
    outline: '#111111',
    background: '#000000',
    position: 'bottom',
    style_json: { safe_area: true, background_opacity: 0.5 },
    language: 'ru',
  },
  {
    id: 3,
    name: 'Жёлтый акцент',
    font: 'Bebas Neue',
    size: 60,
    color: '#FFE14D',
    outline: '#1A1A1A',
    background: null,
    position: 'center',
    style_json: { safe_area: true, bold: true, outline_width: 4 },
    language: 'ru',
  },
]

export const profiles: Profile[] = [
  {
    id: 1,
    name: 'TikTok Drama',
    params_json: {
      categories: ['Эмоциональные сцены', 'Сюжетные твисты'],
      count: 5,
      format: 'single',
      subtitles: true,
      subtitle_preset_id: 1,
      reframe: 'smartcrop',
      target_duration_sec: [15, 40],
      language: 'ru',
      effects: { mirror: false, enhance: true, zoom: true },
    },
  },
  {
    id: 2,
    name: 'Юмор-нарезка',
    params_json: {
      categories: ['Юмор / смешные моменты', 'Цитаты и панчлайны'],
      count: 8,
      format: 'single',
      subtitles: true,
      subtitle_preset_id: 2,
      reframe: 'blurpad',
      target_duration_sec: [10, 30],
      language: 'ru',
      effects: { mirror: false, enhance: false, zoom: false },
    },
  },
]

export const settings: Settings = {
  llm_provider: {
    type: 'groq',
    base_url: 'https://api.groq.com/openai/v1',
    api_key: 'gsk_demo_1234567890abcdef',
    model: 'llama-3.3-70b-versatile',
    model_fast: 'llama-3.1-8b-instant',
  },
  stt_provider: {
    type: 'groq',
    base_url: 'https://api.groq.com/openai/v1',
    api_key: 'gsk_demo_1234567890abcdef',
    model: 'whisper-large-v3-turbo',
  },
  panel_password_set: false,
  panel_password: null,
  default_language: 'ru',
  render: {
    preset: 'medium',
    reframe: 'smartcrop',
    duration_range: [15, 45],
    trim_silence: true,
    encoder: 'auto',
  },
  retention_days: 14,
  backup: { enabled: false, period: 'daily' },
}

export const usage: Usage = {
  llm: { provider: 'Groq · llama-3.3-70b', has_limits: true, used: 642_000, limit: 1_000_000, available: true },
  stt: { provider: 'Groq · whisper-large-v3-turbo', has_limits: true, used: 9_400, limit: 28_800, available: true },
  disk: { free_gb: 318.5, total_gb: 931.0 },
}

export const stats: Stats = { generated: 47, approved: 18 }

export const jobs: Job[] = [
  {
    id: 10,
    movie_id: 2,
    movie_title: 'Интерстеллар',
    type: 'generate',
    status: 'running',
    stage: 'analyze',
    progress: 0.42,
    priority: 7,
    error: null,
    created_at: ago(8),
    started_at: ago(7),
  },
  {
    id: 11,
    movie_id: 1,
    movie_title: 'Начало',
    type: 'generate',
    status: 'queued',
    stage: null,
    progress: 0,
    priority: 5,
    error: null,
    created_at: ago(4),
  },
  {
    id: 12,
    movie_id: 5,
    movie_title: 'Джокер',
    type: 'generate',
    status: 'failed',
    stage: 'transcribe',
    progress: 0.28,
    priority: 5,
    error: 'STT-провайдер вернул 401: неверный API-ключ Groq. Проверьте ключ в Настройках.',
    created_at: ago(120),
    started_at: ago(119),
    finished_at: ago(118),
  },
  {
    id: 13,
    movie_id: 3,
    movie_title: 'Во все тяжкие — S01E01',
    type: 'generate',
    status: 'waiting_limit',
    stage: 'transcribe',
    progress: 0.15,
    priority: 5,
    error: null,
    created_at: ago(40),
    started_at: ago(39),
  },
]

const ratingOf = (o: number, r: number, e: number, d: number, v: number): ShortRating => ({
  overall: o,
  retention: r,
  emotion: e,
  dynamics: d,
  virality: v,
})

const subs = (texts: string[], start: number): SubtitleCue[] =>
  texts.map((text, i) => ({ start: start + i * 2.2, end: start + i * 2.2 + 2.0, text }))

export const shorts: MockShort[] = [
  {
    id: 101,
    job_id: 9,
    movie_id: 2,
    movie_title: 'Интерстеллар',
    moment_id: 'm-201',
    variant_no: 1,
    status: 'draft',
    category: 'Эмоциональные сцены',
    hook_title: '«Не уходи смиренно…»',
    rating: ratingOf(0.92, 0.94, 0.97, 0.7, 0.88),
    reason: 'Сильный эмоциональный пик с узнаваемой цитатой и крупным планом — высокий потенциал удержания.',
    duration: 28,
    start_ts: 3540,
    end_ts: 3568,
    preview_path: 'shorts/Интерстеллар/m-201_v1_preview.mp4',
    file_path: null,
    metadata: {
      title: 'Монолог, от которого мурашки 🌌',
      description: 'Одна из самых сильных сцен «Интерстеллара». #кино #интерстеллар #эмоции',
      hashtags: ['#кино', '#интерстеллар', '#эмоции', '#shorts'],
      first_comment: 'Какой фильм пересмотреть в выходные?',
    },
    subtitles: subs(
      ['Не уходи смиренно', 'в эту добрую ночь.', 'Пусть ярость', 'не угаснет в свете дня.'],
      0,
    ),
    created_at: ago(15),
  },
  {
    id: 102,
    job_id: 9,
    movie_id: 2,
    movie_title: 'Интерстеллар',
    moment_id: 'm-202',
    variant_no: 1,
    status: 'draft',
    category: '«Вау»-моменты',
    hook_title: 'Волна высотой с гору',
    rating: ratingOf(0.86, 0.8, 0.72, 0.95, 0.84),
    reason: 'Визуально эффектный момент с нарастающим напряжением — хорошо заходит без контекста.',
    duration: 22,
    start_ts: 4980,
    end_ts: 5002,
    preview_path: 'shorts/Интерстеллар/m-202_v1_preview.mp4',
    file_path: null,
    metadata: {
      title: 'Та самая сцена с волной 🌊',
      description: 'Масштаб, от которого захватывает дух. #интерстеллар #космос',
      hashtags: ['#интерстеллар', '#космос', '#вау', '#shorts'],
      first_comment: 'Смотрели в IMAX?',
    },
    subtitles: subs(['Это не горы…', 'Это волны.'], 0),
    created_at: ago(15),
  },
  {
    id: 103,
    job_id: 9,
    movie_id: 1,
    movie_title: 'Начало',
    moment_id: 'm-105',
    variant_no: 1,
    status: 'approved',
    category: 'Сюжетные твисты',
    hook_title: 'Волчок всё ещё крутится',
    rating: ratingOf(0.9, 0.88, 0.66, 0.74, 0.93),
    reason: 'Культовая концовка-загадка — провоцирует обсуждение и репосты.',
    duration: 19,
    start_ts: 8740,
    end_ts: 8759,
    preview_path: 'shorts/Начало/m-105_v1_preview.mp4',
    file_path: 'shorts/Начало/m-105_v1_final.mp4',
    metadata: {
      title: 'Сон или реальность? 🌀',
      description: 'Финал, который спорят до сих пор. #начало #inception',
      hashtags: ['#начало', '#inception', '#финал', '#shorts'],
      first_comment: 'Упал волчок или нет? Пишите версии 👇',
    },
    subtitles: subs(['А волчок…', 'всё ещё крутится.'], 0),
    created_at: ago(180),
  },
  {
    id: 104,
    job_id: 9,
    movie_id: 1,
    movie_title: 'Начало',
    moment_id: 'm-106',
    variant_no: 1,
    status: 'rejected',
    category: 'Напряжение / саспенс',
    hook_title: 'Коридор без гравитации',
    rating: ratingOf(0.71, 0.69, 0.6, 0.9, 0.65),
    reason: 'Динамичная сцена, но без яркого хука в первые секунды.',
    duration: 31,
    start_ts: 5210,
    end_ts: 5241,
    preview_path: 'shorts/Начало/m-106_v1_preview.mp4',
    file_path: null,
    metadata: {
      title: 'Драка в невесомости',
      description: 'Как это снимали без CGI? #начало',
      hashtags: ['#начало', '#бтс', '#shorts'],
      first_comment: '',
    },
    subtitles: subs(['Держись…', 'гравитации здесь нет.'], 0),
    created_at: ago(200),
  },
]
