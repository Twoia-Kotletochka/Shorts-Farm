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
  friend: 'Alternix Friend',
}

/** Base URL Alternix Friend для STT-карточки — корень (у LLM это `.../v1`, см. PROVIDER_PRESETS.friend). */
export const FRIEND_STT_BASE_URL = 'https://friend-api.alt.rent'

export const REFRAME_LABELS: Record<ReframeMode, string> = {
  smartcrop: 'Кроп в лицо (9:16)',
  sidecrop: 'Квадратный кроп (4:5 + фон)',
  blurpad: 'Весь кадр + размытый фон',
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
  zoom: 'Наезд (Ken Burns)',
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
  /** Сильные модели по приоритету (2-й проход/метаданные) — дефолт для списка models. */
  llm_models: string[]
  /** Быстрые модели по приоритету (1-й проход) — дефолт для списка models_fast. */
  llm_models_fast: string[]
  stt_models: string[]
  note?: string
}
export const PROVIDER_PRESETS: Record<ProviderType, ProviderPreset> = {
  groq: {
    type: 'groq',
    label: 'Groq',
    base_url: 'https://api.groq.com/openai/v1',
    needs_key: true,
    llm_models: ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'],
    llm_models_fast: ['llama-3.1-8b-instant'],
    stt_models: ['whisper-large-v3-turbo', 'whisper-large-v3'],
    note: 'Бесплатный tier с жёсткими квотами (лимиты считаются на дашборде).',
  },
  openrouter: {
    type: 'openrouter',
    label: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1',
    needs_key: true,
    llm_models: ['meta-llama/llama-3.3-70b-instruct', 'openai/gpt-4o-mini'],
    llm_models_fast: ['meta-llama/llama-3.1-8b-instruct'],
    stt_models: [],
    note: 'Только LLM. Для STT используйте Groq/OpenAI или свой Whisper-сервер.',
  },
  ollama: {
    type: 'ollama',
    label: 'Ollama Cloud',
    base_url: 'https://ollama.com/v1',
    needs_key: true,
    llm_models: ['gpt-oss:120b', 'gemma3:27b', 'gpt-oss:20b'],
    llm_models_fast: ['gpt-oss:20b', 'gemma3:12b', 'ministral-3:8b'],
    stt_models: [],
    note: 'Ollama Cloud (ollama.com) — нужен API-ключ. Только LLM.',
  },
  openai: {
    type: 'openai',
    label: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    needs_key: true,
    llm_models: ['gpt-4o'],
    llm_models_fast: ['gpt-4o-mini'],
    stt_models: ['whisper-1'],
  },
  friend: {
    type: 'friend',
    label: 'Alternix Friend',
    // LLM — OpenAI-совместимый `/v1`; для STT карточка ставит корень (FRIEND_STT_BASE_URL).
    base_url: 'https://friend-api.alt.rent/v1',
    needs_key: true,
    llm_models: ['qwen3:8b'],
    llm_models_fast: ['qwen3:8b'],
    stt_models: ['whisper-large-v3'],
    note: 'Alternix Friend — OpenAI-совместимый LLM + свой STT-эндпоинт. Обычно нужны заголовки Cloudflare Access (см. ниже).',
  },
}
