import { useId, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { Badge, Button, Input } from '@/components/ui'

interface ModelListEditorProps {
  label: string
  hint?: string
  value: string[]
  onChange: (next: string[]) => void
  /** Подсказки для быстрого добавления (чипы + datalist). */
  suggestions?: string[]
}

/** Редактируемый упорядоченный список моделей (add / remove / reorder). Первая — основная. */
export function ModelListEditor({ label, hint, value, onChange, suggestions = [] }: ModelListEditorProps) {
  const [draft, setDraft] = useState('')
  const listId = useId()

  function add(name: string) {
    const v = name.trim()
    if (!v || value.includes(v)) return
    onChange([...value, v])
    setDraft('')
  }
  function remove(i: number) {
    onChange(value.filter((_, j) => j !== i))
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = value.slice()
    const a = next[i]
    const b = next[j]
    if (a === undefined || b === undefined) return
    next[i] = b
    next[j] = a
    onChange(next)
  }

  const free = suggestions.filter((s) => !value.includes(s))

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-content-muted">{label}</div>

      {value.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-content-faint">
          Список пуст — будет использована одиночная модель.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {value.map((m, i) => (
            <li
              key={m}
              className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5"
            >
              <span className="w-4 shrink-0 text-center text-xs text-content-faint">{i + 1}</span>
              <span className="flex-1 truncate font-mono text-sm text-content" title={m}>
                {m}
              </span>
              {i === 0 && <Badge tone="primary">основная</Badge>}
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-content-faint hover:text-content disabled:opacity-30"
                  aria-label="Поднять"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === value.length - 1}
                  className="rounded p-1 text-content-faint hover:text-content disabled:opacity-30"
                  aria-label="Опустить"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded p-1 text-content-faint hover:text-danger"
                  aria-label="Удалить"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
            }
          }}
          placeholder="имя модели…"
          list={listId}
        />
        <datalist id={listId}>
          {free.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => add(draft)}
        >
          Добавить
        </Button>
      </div>

      {free.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {free.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-content-muted transition-colors hover:border-primary hover:text-content"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {hint && <p className="text-xs text-content-faint">{hint}</p>}
    </div>
  )
}
