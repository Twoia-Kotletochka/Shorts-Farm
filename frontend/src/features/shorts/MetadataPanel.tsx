import { Copy } from 'lucide-react'
import { Button, toast } from '@/components/ui'
import type { ShortMetadata } from '@/types/api'

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Скопировано', label)
  } catch {
    toast.error('Не удалось скопировать')
  }
}

function CopyRow({
  label,
  value,
  copyLabel,
  mono,
}: {
  label: string
  value: string
  copyLabel: string
  mono?: boolean
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-content-muted">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5"
          leftIcon={<Copy className="h-3.5 w-3.5" />}
          onClick={() => copy(value, copyLabel)}
        >
          Копировать
        </Button>
      </div>
      <p className={`whitespace-pre-wrap break-words rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-content ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </p>
    </div>
  )
}

/** Панель сгенерированных метаданных шортса с копированием каждого поля. */
export function MetadataPanel({ metadata }: { metadata: ShortMetadata }) {
  const hashtagsLine = metadata.hashtags.join(' ')
  return (
    <div className="space-y-3">
      <CopyRow label="Заголовок" value={metadata.title} copyLabel="Заголовок" />
      <CopyRow label="Описание" value={metadata.description} copyLabel="Описание" />

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-content-muted">Хэштеги</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5"
            leftIcon={<Copy className="h-3.5 w-3.5" />}
            onClick={() => copy(hashtagsLine, 'Хэштеги')}
          >
            Копировать
          </Button>
        </div>
        {metadata.hashtags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {metadata.hashtags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-content-faint">—</p>
        )}
      </div>

      <CopyRow label="Первый комментарий" value={metadata.first_comment} copyLabel="Комментарий" />

      {metadata.variants && metadata.variants.length > 0 && (
        <div>
          <span className="mb-1 block text-xs font-medium text-content-muted">
            Альтернативные заголовки
          </span>
          <ul className="space-y-1.5">
            {metadata.variants.map((v, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5">
                <span className="truncate text-sm text-content">{v}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label="Копировать вариант"
                  onClick={() => copy(v, 'Вариант заголовка')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
