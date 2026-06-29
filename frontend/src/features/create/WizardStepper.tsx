import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Progress } from '@/components/ui'
import { STEPS, type StepId } from './wizard'

interface WizardStepperProps {
  current: StepId
  /** Индексы шагов, которые можно открыть напрямую (валидны/уже пройдены). */
  reachable: Set<number>
  onJump: (index: number) => void
}

/** Левая колонка визарда: список шагов с прогрессом. */
export function WizardStepper({ current, reachable, onJump }: WizardStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === current)
  const progress = (currentIndex + 1) / STEPS.length

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-content-faint">
          <span>
            Шаг {currentIndex + 1} из {STEPS.length}
          </span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <Progress value={progress} />
      </div>

      <ol className="space-y-1">
        {STEPS.map((step, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          const canJump = reachable.has(i) && !active
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={!canJump && !active}
                onClick={() => canJump && onJump(i)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                  active && 'bg-primary/10',
                  canJump && 'hover:bg-surface-2',
                  !canJump && !active && 'cursor-not-allowed opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                    done && 'bg-success/15 text-success',
                    active && 'bg-primary text-primary-fg',
                    !done && !active && 'bg-surface-3 text-content-faint',
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block truncate text-sm font-medium',
                      active ? 'text-content' : 'text-content-muted',
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="block truncate text-xs text-content-faint">{step.subtitle}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
