import { useState } from 'react'
import { Star, ImageOff } from 'lucide-react'
import { shortPreviewUrl, shortThumbUrl } from '@/api/endpoints'
import { IS_MOCK } from '@/api/http'
import { ratingTo100 } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { SubtitleCue } from '@/types/api'

export interface ShortPlayerProps {
  id: number
  hasPreview: boolean
  overall?: number
  /** Мягкие субтитры для оверлея (детальный режим). В списке не передаются. */
  subtitles?: SubtitleCue[]
  /** Позиция оверлея субтитров. */
  subtitlePosition?: 'top' | 'center' | 'bottom'
  className?: string
}

/**
 * Превью шортса в соотношении 9:16.
 * В mock-режиме реального видео нет → постер + статичный оверлей субтитров.
 * Иначе (есть preview) — нативный <video> с постером.
 */
export function ShortPlayer({
  id,
  hasPreview,
  overall,
  subtitles,
  subtitlePosition = 'bottom',
  className,
}: ShortPlayerProps) {
  const [imgError, setImgError] = useState(false)
  const thumb = shortThumbUrl(id)
  const useVideo = !IS_MOCK && hasPreview

  // Для статичного оверлея в mock берём первую реплику (видео не играет — таймкода нет).
  const overlayText = subtitles && subtitles.length > 0 ? subtitles[0]?.text : undefined

  return (
    <div
      className={cn(
        'relative aspect-[9/16] w-full overflow-hidden rounded-lg border border-border bg-black',
        className,
      )}
    >
      {useVideo ? (
        <video
          controls
          poster={thumb}
          src={shortPreviewUrl(id)}
          className="h-full w-full object-cover"
        />
      ) : imgError ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-2 text-content-faint">
          <ImageOff className="h-8 w-8" />
          <span className="text-xs">Нет превью</span>
        </div>
      ) : (
        <img
          src={thumb}
          alt=""
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      )}

      {/* Оверлей субтитров (только когда не нативное видео — у video свои дорожки) */}
      {!useVideo && overlayText && (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 flex justify-center px-3',
            subtitlePosition === 'top' && 'top-4',
            subtitlePosition === 'center' && 'top-1/2 -translate-y-1/2',
            subtitlePosition === 'bottom' && 'bottom-6',
          )}
        >
          <span className="max-w-full rounded bg-black/55 px-2 py-1 text-center text-sm font-semibold leading-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
            {overlayText}
          </span>
        </div>
      )}

      {/* Бейдж рейтинга */}
      {overall != null && (
        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-xs font-bold text-warning backdrop-blur-sm">
          <Star className="h-3 w-3 fill-current" />
          {ratingTo100(overall)}
        </div>
      )}
    </div>
  )
}
