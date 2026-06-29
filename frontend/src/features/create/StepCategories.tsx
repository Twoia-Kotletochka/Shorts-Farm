import { Link } from 'react-router-dom'
import { Check, Tags } from 'lucide-react'
import { useCategories } from '@/api/hooks'
import { Button, EmptyState, Skeleton, Tooltip } from '@/components/ui'
import { QueryBoundary } from '@/components/common/QueryBoundary'
import { cn } from '@/lib/cn'

interface StepCategoriesProps {
  selected: string[]
  onChange: (next: string[]) => void
}

export function StepCategories({ selected, onChange }: StepCategoriesProps) {
  const categories = useCategories()

  const toggle = (name: string) => {
    onChange(
      selected.includes(name) ? selected.filter((c) => c !== name) : [...selected, name],
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-content-muted">
        Выберите хотя бы одну категорию — LLM будет искать в фильме именно такие моменты.
      </p>

      <QueryBoundary
        query={categories}
        skeleton={
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-40" />
            ))}
          </div>
        }
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            icon={Tags}
            title="Категорий пока нет"
            description="Создайте категории в настройках, чтобы задать, что искать."
            action={
              <Link to="/settings">
                <Button variant="secondary" size="sm">
                  В настройки
                </Button>
              </Link>
            }
          />
        }
      >
        {(data) => (
          <div className="flex flex-wrap gap-2">
            {data.map((cat) => {
              const active = selected.includes(cat.name)
              const chip = (
                <button
                  type="button"
                  onClick={() => toggle(cat.name)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary/15 text-content'
                      : 'border-border bg-surface text-content-muted hover:border-border-strong hover:bg-surface-2',
                  )}
                >
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                  {cat.name}
                </button>
              )
              return cat.hint ? (
                <Tooltip key={cat.id} content={cat.hint}>
                  {chip}
                </Tooltip>
              ) : (
                <span key={cat.id}>{chip}</span>
              )
            })}
          </div>
        )}
      </QueryBoundary>

      <p className="text-xs text-content-faint">
        Выбрано: {selected.length || '—'}
      </p>
    </div>
  )
}
