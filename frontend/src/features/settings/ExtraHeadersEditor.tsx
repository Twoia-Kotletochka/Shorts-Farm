import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Button, Input } from '@/components/ui'

/**
 * Редактор доп. HTTP-заголовков провайдера (Cloudflare Access и т.п.).
 * Значения — секреты (password-поле). На выдаче маскируются («****xxxx»): если оставить маску,
 * бэкенд сохранит прежнее значение (по id провайдера + имени заголовка).
 *
 * Контракт наружу — `Record<string,string>`; внутри держим упорядоченный список строк, чтобы
 * пустые/дублирующиеся имена во время набора не «схлопывались». Пустые имена в запись не попадают.
 * Компонент контролируемый: внешняя замена `value` (напр. пресет «Alternix Friend») переинициализирует
 * строки; собственные правки не вызывают ресинк (сверяемся по последнему испущенному объекту).
 */

const CF_HEADERS = ['CF-Access-Client-Id', 'CF-Access-Client-Secret'] as const

interface Row {
  id: string
  k: string
  v: string
}

let rowSeq = 0
const nextId = () => `hdr-${rowSeq++}`

function toRows(value?: Record<string, string> | null): Row[] {
  return Object.entries(value ?? {}).map(([k, v]) => ({ id: nextId(), k, v }))
}
function toRecord(rows: Row[]): Record<string, string> {
  const rec: Record<string, string> = {}
  for (const r of rows) {
    const name = r.k.trim()
    if (name) rec[name] = r.v // пустые имена не отправляем; при дубле — последнее значение
  }
  return rec
}

interface ExtraHeadersEditorProps {
  value?: Record<string, string> | null
  onChange: (next: Record<string, string>) => void
}

export function ExtraHeadersEditor({ value, onChange }: ExtraHeadersEditorProps) {
  const [rows, setRows] = useState<Row[]>(() => toRows(value))
  const [open, setOpen] = useState(() => Object.keys(value ?? {}).length > 0)
  // Последний объект, «исходящий» от нас: чтобы не переинициализировать строки на собственные onChange.
  const lastEmitted = useRef<Record<string, string> | null | undefined>(value)

  useEffect(() => {
    if (value === lastEmitted.current) return
    setRows(toRows(value))
    lastEmitted.current = value
    if (value && Object.keys(value).length > 0) setOpen(true)
  }, [value])

  function commit(next: Row[]) {
    setRows(next)
    const rec = toRecord(next)
    lastEmitted.current = rec
    onChange(rec)
  }

  const setRow = (id: string, patch: Partial<Row>) =>
    commit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const removeRow = (id: string) => commit(rows.filter((r) => r.id !== id))
  const addRow = () => {
    commit([...rows, { id: nextId(), k: '', v: '' }])
    setOpen(true)
  }
  const addCfPreset = () => {
    const have = new Set(rows.map((r) => r.k.trim()))
    const extra = CF_HEADERS.filter((n) => !have.has(n)).map((k) => ({ id: nextId(), k, v: '' }))
    if (extra.length) commit([...rows, ...extra])
    setOpen(true)
  }

  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-content-muted hover:text-content"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <ShieldCheck className="h-4 w-4 text-content-faint" />
        Доп. заголовки (Cloudflare Access)
        {rows.length > 0 && <span className="text-xs text-content-faint">· {rows.length}</span>}
      </button>

      {open && (
        <div className="space-y-2 border-t border-border p-3">
          {rows.length === 0 && (
            <p className="text-xs text-content-faint">
              Заголовки не заданы. Для Cloudflare Access добавьте пару Client-Id / Client-Secret.
            </p>
          )}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  aria-label="Имя заголовка"
                  value={r.k}
                  onChange={(e) => setRow(r.id, { k: e.target.value })}
                  placeholder="CF-Access-Client-Id"
                />
              </div>
              <div className="flex-1">
                <Input
                  aria-label="Значение заголовка"
                  type="password"
                  value={r.v}
                  onChange={(e) => setRow(r.id, { v: e.target.value })}
                  placeholder="значение (секрет)"
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(r.id)}
                aria-label="Удалить заголовок"
                className="rounded p-1 text-content-faint hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={addRow}
            >
              Заголовок
            </Button>
            <Button variant="ghost" size="sm" onClick={addCfPreset}>
              + Cloudflare Access
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
