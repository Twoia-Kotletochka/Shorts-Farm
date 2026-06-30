import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Rocket, Settings as SettingsIcon, TriangleAlert } from 'lucide-react'
import {
  useCreateJob,
  useEstimateJob,
  useHealth,
  useMovies,
  usePresets,
} from '@/api/hooks'
import { Button, Card, CardContent, CardHeader, toast } from '@/components/ui'
import { PageHeader } from '@/components/common/PageHeader'
import { apiErrorMessage } from '@/api/http'
import { isHealthUp } from '@/lib/labels'
import type { JobEffects, JobParams } from '@/types/api'

import { DEFAULT_PARAMS, STEPS, isStepValid, type StepId } from '@/features/create/wizard'
import { WizardStepper } from '@/features/create/WizardStepper'
import { ProfileBar } from '@/features/create/ProfileBar'
import { HistoryList } from '@/features/create/HistoryList'
import { StepMovie } from '@/features/create/StepMovie'
import { StepCategories } from '@/features/create/StepCategories'
import { StepCount } from '@/features/create/StepCount'
import { StepSubtitles } from '@/features/create/StepSubtitles'
import { StepEffects } from '@/features/create/StepEffects'
import { StepExtra } from '@/features/create/StepExtra'
import { StepReview } from '@/features/create/StepReview'

export function CreatePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const movies = useMovies()
  const presets = usePresets()
  const health = useHealth()
  const createJob = useCreateJob()
  const estimate = useEstimateJob()

  const [params, setParams] = useState<JobParams>(DEFAULT_PARAMS)
  const [stepIndex, setStepIndex] = useState(0)
  /** Самый дальний достигнутый шаг — для прыжков по степперу. */
  const [maxReached, setMaxReached] = useState(0)

  // Предвыбор фильма из ?movie=…
  useEffect(() => {
    const raw = searchParams.get('movie')
    if (!raw) return
    const id = Number(raw)
    if (Number.isFinite(id) && id > 0) {
      setParams((p) => (p.movie_id === id ? p : { ...p, movie_id: id }))
    }
  }, [searchParams])

  const patch = (next: Partial<JobParams>) => setParams((p) => ({ ...p, ...next }))
  const setEffect = (key: keyof JobEffects, value: boolean) =>
    setParams((p) => ({ ...p, effects: { ...p.effects, [key]: value } }))

  const applyProfile = (incoming: Partial<JobParams>) => {
    // Профиль не должен трогать выбранный фильм.
    const { movie_id: _ignore, ...rest } = incoming
    setParams((p) => ({ ...p, ...rest }))
  }

  const step = STEPS[stepIndex]!
  const currentId: StepId = step.id
  const canAdvance = isStepValid(currentId, params)
  const isLast = stepIndex === STEPS.length - 1

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, index))
    setStepIndex(clamped)
    setMaxReached((m) => Math.max(m, clamped))
  }
  const next = () => {
    if (!canAdvance) return
    goTo(stepIndex + 1)
  }
  const back = () => goTo(stepIndex - 1)

  // Шаги, доступные для прямого перехода: все до достигнутого при условии валидности предыдущих.
  const reachable = useMemo(() => {
    const set = new Set<number>()
    for (let i = 0; i <= maxReached; i++) {
      const allBeforeValid = STEPS.slice(0, i).every((s) => isStepValid(s.id, params))
      if (allBeforeValid) set.add(i)
    }
    return set
  }, [maxReached, params])

  const selectedMovie = movies.data?.find((m) => m.id === params.movie_id)
  const selectedPreset =
    params.subtitle_preset_id != null
      ? presets.data?.find((p) => p.id === params.subtitle_preset_id)
      : undefined

  const needsSetup =
    health.data && (!isHealthUp(health.data.llm_provider) || !isHealthUp(health.data.stt_provider))

  const launch = () => {
    if (!isStepValid('movie', params) || !isStepValid('categories', params)) {
      toast.error('Заполните обязательные шаги', 'Нужен фильм и хотя бы одна категория')
      return
    }
    createJob.mutate(params, {
      onSuccess: () => {
        toast.success('Задача запущена', 'Следите за прогрессом в очереди')
        navigate('/queue')
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Пошаговый запуск генерации вертикальных шортсов из фильма."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setParams(DEFAULT_PARAMS)
              setStepIndex(0)
              setMaxReached(0)
            }}
          >
            Сбросить
          </Button>
        }
      />

      {/* Онбординг: провайдер не настроен */}
      {needsSetup && (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center gap-3">
            <TriangleAlert className="h-5 w-5 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-medium text-content">Сначала подключите LLM/STT-провайдера</p>
              <p className="text-content-muted">
                Без настроенных провайдеров задача не сможет проанализировать видео.
              </p>
            </div>
          </div>
          <Link to="/settings">
            <Button variant="secondary" size="sm" leftIcon={<SettingsIcon className="h-4 w-4" />}>
              В настройки
            </Button>
          </Link>
        </Card>
      )}

      {/* Профили + история */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Профили настроек"
            description="Примените сохранённый набор параметров или сохраните текущий."
          />
          <CardContent className="pt-0">
            <ProfileBar params={params} onApply={applyProfile} />
          </CardContent>
        </Card>
        <HistoryList />
      </div>

      {/* Визард */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit p-4 lg:sticky lg:top-4">
          <WizardStepper current={currentId} reachable={reachable} onJump={goTo} />
        </Card>

        <Card>
          <CardHeader title={step.title} description={step.subtitle} />
          <CardContent className="pt-0">
            {currentId === 'movie' && (
              <StepMovie
                selectedId={params.movie_id}
                audioTrack={params.audio_track ?? null}
                onSelect={(id) => patch({ movie_id: id, audio_track: null })}
                onAudioTrack={(audio_track) => patch({ audio_track })}
              />
            )}
            {currentId === 'categories' && (
              <StepCategories
                selected={params.categories}
                onChange={(categories) => patch({ categories })}
              />
            )}
            {currentId === 'count' && (
              <StepCount
                count={params.count}
                format={params.format}
                segmentSec={params.compilation_segment_sec ?? null}
                totalSec={params.compilation_total_sec ?? null}
                onCount={(count) => patch({ count })}
                onFormat={(format) =>
                  patch(
                    format === 'single'
                      ? { format, compilation_segment_sec: null, compilation_total_sec: null }
                      : { format },
                  )
                }
                onSegmentSec={(compilation_segment_sec) => patch({ compilation_segment_sec })}
                onTotalSec={(compilation_total_sec) => patch({ compilation_total_sec })}
              />
            )}
            {currentId === 'subtitles' && (
              <StepSubtitles
                subtitles={params.subtitles}
                presetId={params.subtitle_preset_id}
                language={params.subtitle_language}
                onToggle={(subtitles) => patch({ subtitles })}
                onPreset={(subtitle_preset_id) => patch({ subtitle_preset_id })}
                onLanguage={(subtitle_language) => patch({ subtitle_language })}
              />
            )}
            {currentId === 'effects' && (
              <StepEffects
                effects={params.effects}
                reframe={params.reframe}
                onEffect={setEffect}
                onReframe={(reframe) => patch({ reframe })}
              />
            )}
            {currentId === 'extra' && (
              <StepExtra
                duration={params.target_duration_sec}
                language={params.language}
                allowDuplicates={params.allow_duplicates ?? false}
                onDuration={(target_duration_sec) => patch({ target_duration_sec })}
                onLanguage={(language) => patch({ language })}
                onAllowDuplicates={(allow_duplicates) => patch({ allow_duplicates })}
              />
            )}
            {currentId === 'review' && (
              <StepReview
                params={params}
                movieTitle={selectedMovie?.title ?? `Фильм #${params.movie_id}`}
                presetName={selectedPreset?.name ?? null}
                estimate={estimate}
              />
            )}
          </CardContent>

          <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
            <Button
              variant="ghost"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              disabled={stepIndex === 0}
              onClick={back}
            >
              Назад
            </Button>

            {isLast ? (
              <Button
                variant="primary"
                leftIcon={<Rocket className="h-4 w-4" />}
                loading={createJob.isPending}
                onClick={launch}
              >
                Запустить генерацию
              </Button>
            ) : (
              <Button
                variant="primary"
                rightIcon={<ArrowRight className="h-4 w-4" />}
                disabled={!canAdvance}
                onClick={next}
              >
                Далее
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
