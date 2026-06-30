import { useState } from 'react'
import { Star, ImageOff } from 'lucide-react'
import { Spinner } from '@/components/ui'
import { shortPreviewUrl, shortThumbUrl } from '@/api/endpoints'
import { IS_MOCK } from '@/api/http'
import { ratingTo100 } from '@/lib/format'
import { cn } from '@/lib/cn'

export interface ShortPlayerProps {
  id: number
  hasPreview: boolean
  /** Версия файлов — добавляется как ?v=rev (сброс кэша после ре-рендера). */
  rev?: number
  overall?: number
  /** Идёт ре-рендер превью — показать оверлей «обновляется…». */
  busy?: boolean
  className?: string
}

/**
 * Превью шортса 9:16. Субтитры теперь ПРОЖИГАЮТСЯ в превью бэкендом (WYSIWYG) —
 * мягкий оверлей больше не рисуем. В mock-режиме реального видео нет → постер.
 */
export function ShortPlayer({ id, hasPreview, rev, overall, busy, className }: ShortPlayerProps) {
  const [imgError, setImgError] = useState(false)
  const thumb = shortThumbUrl(id, rev)
  const useVideo = !IS_MOCK && hasPreview

  return (
    <div
      className={cn(
        'relative aspect-[9/16] w-full overflow-hidden rounded-lg border border-border bg-black',
        className,
      )}
    >
      {useVideo ? (
        // key={rev} — пере-монтируем <video> при смене версии, чтобы гарантированно перезагрузить.
        <video
          key={rev}
          controls
          poster={thumb}
          src={shortPreviewUrl(id, rev)}
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

      {busy && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 backdrop-blur-sm">
          <Spinner className="h-6 w-6 text-white" />
          <span className="text-xs font-medium text-white">обновляется…</span>
        </div>
      )}

      {overall != null && (
        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-xs font-bold text-warning backdrop-blur-sm">
          <Star className="h-3 w-3 fill-current" />
          {ratingTo100(overall)}
        </div>
      )}
    </div>
  )
}
