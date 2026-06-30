import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Download, Maximize, Settings2, Star, X } from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { ShortStatusBadge } from '@/components/common/badges'
import { shortFileUrl, shortPreviewUrl, shortThumbUrl } from '@/api/endpoints'
import { IS_MOCK } from '@/api/http'
import { ratingTo100 } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ShortListItem } from '@/types/api'

type Size = 'S' | 'M' | 'L'
const SIZE_VH: Record<Size, string> = {
  S: 'h-[52vh]',
  M: 'h-[68vh]',
  L: 'h-[84vh]',
}

export interface ShortViewerModalProps {
  short: ShortListItem | null
  open: boolean
  onClose: () => void
  onApprove: (s: ShortListItem) => void
  onReject: (s: ShortListItem) => void
  onDetails: (s: ShortListItem) => void
  pendingApprove?: boolean
  pendingReject?: boolean
}

/**
 * Крупный просмотр шортса (лайтбокс): вертикальное 9:16 видео по центру на ~52–84vh,
 * пресеты размера S/M/L + нативный fullscreen. Субтитры уже прожжены в превью.
 * src с `?v=rev` (+ `panel_key` при пароле) — после ре-рендера показывается новая версия.
 */
export function ShortViewerModal({
  short,
  open,
  onClose,
  onApprove,
  onReject,
  onDetails,
  pendingApprove,
  pendingReject,
}: ShortViewerModalProps) {
  const [size, setSize] = useState<Size>('L')
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open || !short) return null

  const useVideo = !IS_MOCK && short.has_preview
  const renderingFinal = short.status === 'approved' && !short.has_final
  const fullscreen = () => void videoRef.current?.requestFullscreen?.()

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Верхняя панель */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{short.hook_title ?? 'Шортс'}</p>
          {short.movie_title && <p className="truncate text-xs text-white/60">{short.movie_title}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-white/20">
            {(['S', 'M', 'L'] as Size[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={cn(
                  'px-2.5 py-1 text-xs font-semibold transition-colors',
                  size === s ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white',
                )}
              >
                {s}
              </button>
            ))}
          </div>
          {useVideo && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              aria-label="На весь экран"
              onClick={fullscreen}
            >
              <Maximize className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Видео по центру */}
      <div
        className="flex flex-1 items-center justify-center overflow-hidden px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            'relative aspect-[9/16] max-h-full overflow-hidden rounded-lg bg-black shadow-pop transition-[height] duration-200',
            SIZE_VH[size],
          )}
        >
          {useVideo ? (
            <video
              key={short.rev}
              ref={videoRef}
              controls
              poster={shortThumbUrl(short.id, short.rev)}
              src={shortPreviewUrl(short.id, short.rev)}
              className="h-full w-full object-contain"
            />
          ) : (
            <img
              src={shortThumbUrl(short.id, short.rev)}
              alt=""
              className="h-full w-full object-contain"
            />
          )}
          <div className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-xs font-bold text-warning">
            <Star className="h-3 w-3 fill-current" />
            {ratingTo100(short.rating.overall)}
          </div>
        </div>
      </div>

      {/* Нижняя панель действий */}
      <div
        className="flex flex-wrap items-center justify-center gap-2 px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <ShortStatusBadge status={short.status} />
        {short.status === 'draft' && (
          <Button
            size="sm"
            leftIcon={<Check className="h-4 w-4" />}
            loading={pendingApprove}
            onClick={() => onApprove(short)}
          >
            Одобрить
          </Button>
        )}
        {short.status !== 'rejected' && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<X className="h-4 w-4" />}
            loading={pendingReject}
            onClick={() => onReject(short)}
          >
            Отклонить
          </Button>
        )}
        {short.has_final && (
          <a href={shortFileUrl(short.id, short.rev)} download>
            <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />}>
              Скачать
            </Button>
          </a>
        )}
        {renderingFinal && (
          <span className="inline-flex items-center gap-2 text-sm text-white/70">
            <Spinner className="h-4 w-4" />
            рендерим финал…
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10"
          leftIcon={<Settings2 className="h-4 w-4" />}
          onClick={() => onDetails(short)}
        >
          Детали и правка
        </Button>
      </div>
    </div>,
    document.body,
  )
}
