import type { JobParams } from '@/types/api'

/** Разумные дефолты формы запуска генерации. */
export const DEFAULT_PARAMS: JobParams = {
  movie_id: 0,
  categories: [],
  count: 5,
  format: 'single',
  subtitles: true,
  subtitle_preset_id: null,
  subtitle_language: 'ru',
  effects: { mirror: false, enhance: true, zoom: false },
  reframe: 'sidecrop',
  target_duration_sec: [15, 40],
  language: 'ru',
  allow_duplicates: false,
  profile_id: null,
}

export const STEP_IDS = [
  'movie',
  'categories',
  'count',
  'subtitles',
  'effects',
  'extra',
  'review',
] as const
export type StepId = (typeof STEP_IDS)[number]

export interface StepMeta {
  id: StepId
  title: string
  subtitle: string
}

export const STEPS: StepMeta[] = [
  { id: 'movie', title: 'Фильм', subtitle: 'Источник для нарезки' },
  { id: 'categories', title: 'Категории', subtitle: 'Что искать в фильме' },
  { id: 'count', title: 'Количество и тип', subtitle: 'Сколько и каким форматом' },
  { id: 'subtitles', title: 'Субтитры', subtitle: 'Стиль и язык' },
  { id: 'effects', title: 'Эффекты и кадр', subtitle: 'Обработка видео' },
  { id: 'extra', title: 'Доп. параметры', subtitle: 'Длительность и язык' },
  { id: 'review', title: 'Запуск', subtitle: 'Сводка и прикидка' },
]

/** Языки контента/субтитров для быстрого выбора. */
export const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'uk', label: 'Українська' },
]

/** Можно ли уйти с шага дальше (валидация). */
export function isStepValid(id: StepId, p: JobParams): boolean {
  switch (id) {
    case 'movie':
      return p.movie_id > 0
    case 'categories':
      return p.categories.length >= 1
    case 'count':
      return p.count >= 1 && p.count <= 20
    default:
      return true
  }
}
