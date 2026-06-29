/** Единый словарь русских лейблов и пресетов — чтобы все вкладки писали одинаково. */
import type {
  HealthFlag,
  JobStage,
  JobStatus,
  MovieStatus,
  ProviderType,
  ReframeMode,
  ShortFormat,
  ShortStatus,
  SubtitlePosition,
  TranscriptionStatus,
} from '@/types/api'

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

/** Здоров ли сервис/провайдер. Бэкенд отдаёт `true` или строку "ok"; "not_configured"/"error" → нет. */
export function isHealthUp(flag: HealthFlag): boolean {
  return flag === true || flag === 'ok'
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: 'В очереди',
  running: 'Выполняется',
  waiting_limit: 'Ждёт сброса лимита',
  done: 'Готово',
  failed: 'Ошибка',
  canceled: 'Отменено',
}
export const JOB_STATUS_TONE: Record<JobStatus, Tone> = {
  queued: 'neutral',
  running: 'info',
  waiting_limit: 'warning',
  done: 'success',
  failed: 'danger',
  canceled: 'neutral',
}

export const JOB_STAGE_LABELS: Record<JobStage, string> = {
  probe: 'Анализ файла',
  extract_audio: 'Извлечение аудио',
  transcribe: 'Транскрипция',
  scene_detect: 'Детект сцен',
  analyze: 'Поиск моментов (LLM)',
  select: 'Отбор лучших',
  preview: 'Черновой предпросмотр',
  awaiting_approval: 'Ожидает одобрения',
  render: 'Финальный рендер',
  metadata: 'Метаданные',
  finished: 'Завершено',
}
/** Порядок стадий пайплайна для прогресс-индикатора. */
export const PIPELINE_STAGES: JobStage[] = [
  'probe',
  'extract_audio',
  'transcribe',
  'scene_detect',
  'analyze',
  'select',
  'preview',
  'render',
  'metadata',
  'finished',
]

export const MOVIE_STATUS_LABELS: Record<MovieStatus, string> = {
  new: 'Новый',
  error: 'Ошибка',
}

export const TRANSCRIPTION_STATUS_LABELS: Record<TranscriptionStatus, string> = {
  none: 'Нет транскрипта',
  pending: 'Транскрибируется',
  done: 'Транскрипт готов',
  error: 'Ошибка транскрипции',
}
export const TRANSCRIPTION_STATUS_TONE: Record<TranscriptionStatus, Tone> = {
  none: 'neutral',
  pending: 'info',
  done: 'success',
  error: 'danger',
}

export const SHORT_STATUS_LABELS: Record<ShortStatus, string> = {
  draft: 'Черновик',
  approved: 'Одобрен',
  rejected: 'Отклонён',
}
export const SHORT_STATUS_TONE: Record<ShortStatus, Tone> = {
  draft: 'warning',
  approved: 'success',
  rejected: 'neutral',
}

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  groq: 'Groq',
  openrouter: 'OpenRouter',
  ollama: 'Ollama Cloud',
  openai: 'OpenAI',
}

export const REFRAME_LABELS: Record<ReframeMode, string> = {
  smartcrop: 'Умная обрезка (smart-crop)',
  blurpad: 'Размытый фон',
}

export const FORMAT_LABELS: Record<ShortFormat, string> = {
  single: 'Одна сцена',
  compilation: 'Компиляция',
}

export const SUBTITLE_POSITION_LABELS: Record<SubtitlePosition, string> = {
  top: 'Сверху',
  center: 'По центру',
  bottom: 'Снизу',
}

export const EFFECT_LABELS = {
  mirror: 'Зеркало',
  enhance: 'Улучшение',
  zoom: 'Zoom',
} as const

export const RATING_CRITERIA: { key: 'retention' | 'emotion' | 'dynamics' | 'virality'; label: string }[] = [
  { key: 'retention', label: 'Удержание' },
  { key: 'emotion', label: 'Эмоция' },
  { key: 'dynamics', label: 'Динамика' },
  { key: 'virality', label: 'Виральность' },
]

/** Пресеты AI-провайдеров для настроек (base_url + типовые модели). */
export interface ProviderPreset {
  type: ProviderType
  label: string
  base_url: string
  needs_key: boolean
  llm_models: string[]
  stt_models: string[]
  note?: string
}
export const PROVIDER_PRESETS: Record<ProviderType, ProviderPreset> = {
  groq: {
    type: 'groq',
    label: 'Groq',
    base_url: 'https://api.groq.com/openai/v1',
    needs_key: true,
    llm_models: [
      'llama-3.3-70b-versatile',
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'llama-3.1-8b-instant',
    ],
    stt_models: ['whisper-large-v3-turbo', 'whisper-large-v3'],
    note: 'Бесплатный tier с жёсткими квотами (лимиты считаются на дашборде).',
  },
  openrouter: {
    type: 'openrouter',
    label: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1',
    needs_key: true,
    llm_models: ['meta-llama/llama-3.3-70b-instruct', 'openai/gpt-4o-mini'],
    stt_models: [],
    note: 'Только LLM. Для STT используйте Groq/OpenAI или свой Whisper-сервер.',
  },
  ollama: {
    type: 'ollama',
    label: 'Ollama Cloud',
    base_url: 'https://ollama.com/v1',
    needs_key: true,
    llm_models: ['gpt-oss:120b', 'gpt-oss:20b', 'deepseek-v3.1:671b', 'qwen3-coder:480b'],
    stt_models: [],
    note: 'Ollama Cloud (ollama.com) — нужен API-ключ. Только LLM.',
  },
  openai: {
    type: 'openai',
    label: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    needs_key: true,
    llm_models: ['gpt-4o-mini', 'gpt-4o'],
    stt_models: ['whisper-1'],
  },
}
