import { useMemo } from 'react'
import type { SubtitlePresetInput } from '@/types/api'
import { cn } from '@/lib/cn'

const SAMPLE = 'Пример субтитров для превью'

/** Преобразование hex (#RRGGBB) → rgba(...) c заданной альфой. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim())
  if (!m) return `rgba(0,0,0,${alpha})`
  const r = parseInt(m[1] ?? '00', 16)
  const g = parseInt(m[2] ?? '00', 16)
  const b = parseInt(m[3] ?? '00', 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Слои text-shadow для имитации обводки заданной толщины. */
function buildOutline(color: string, width: number): string | undefined {
  if (width <= 0) return undefined
  const w = Math.round(width)
  const offsets: string[] = []
  for (let dx = -w; dx <= w; dx += 1) {
    for (let dy = -w; dy <= w; dy += 1) {
      if (dx === 0 && dy === 0) continue
      offsets.push(`${dx}px ${dy}px 0 ${color}`)
    }
  }
  return offsets.join(', ')
}

export interface SubtitlePreviewProps {
  preset: SubtitlePresetInput
}

/** Живое превью кадра 9:16 с образцом субтитра по текущим настройкам пресета. */
export function SubtitlePreview({ preset }: SubtitlePreviewProps) {
  const style = preset.style_json ?? {}
  const safeArea = style.safe_area === true
  const karaoke = style.karaoke === true
  const bold = style.bold === true
  const italic = style.italic === true
  const outlineWidth = typeof style.outline_width === 'number' ? style.outline_width : 0
  const bgOpacity = typeof style.background_opacity === 'number' ? style.background_opacity : 0.5

  // Размер шрифта в реальных пикселях рендера 1080px масштабируем к ширине превью (~292px).
  const fontPx = useMemo(() => Math.max(10, (preset.size / 1080) * 292), [preset.size])

  const textShadow = buildOutline(preset.outline, outlineWidth)

  const align =
    preset.position === 'top'
      ? 'items-start'
      : preset.position === 'center'
        ? 'items-center'
        : 'items-end'

  // Отступы текста: при safe-area держим текст внутри безопасной зоны.
  const padTop = safeArea ? '16%' : '5%'
  const padBottom = safeArea ? '14%' : '5%'

  const words = SAMPLE.split(' ')

  return (
    <div
      className="relative mx-auto w-full max-w-[292px] overflow-hidden rounded-xl border border-border shadow-elev aspect-[9/16] max-h-[520px]"
      style={{
        background:
          'radial-gradient(120% 80% at 50% 20%, #2b2233 0%, #1a1622 45%, #0c0a12 100%)',
      }}
      aria-label="Превью субтитров"
    >
      {/* Имитация кадра — мягкие пятна света */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute left-1/4 top-1/3 h-24 w-24 -translate-x-1/2 rounded-full bg-primary/20 blur-2xl" />
        <div className="absolute right-1/4 bottom-1/4 h-28 w-28 rounded-full bg-accent/10 blur-2xl" />
      </div>

      {/* Safe-area зоны интерфейса */}
      {safeArea && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[15%] items-center justify-center border-b border-dashed border-white/15 bg-black/30">
            <span className="text-[9px] uppercase tracking-wide text-white/40">
              зона интерфейса
            </span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[12%] items-center justify-center border-t border-dashed border-white/15 bg-black/30">
            <span className="text-[9px] uppercase tracking-wide text-white/40">
              зона интерфейса
            </span>
          </div>
        </>
      )}

      {/* Слой субтитра */}
      <div
        className={cn('absolute inset-0 flex justify-center px-4', align)}
        style={{ paddingTop: padTop, paddingBottom: padBottom }}
      >
        <div
          className="max-w-[90%] text-center leading-tight"
          style={{
            fontFamily: `'${preset.font}', system-ui, sans-serif`,
            fontSize: `${fontPx}px`,
            fontWeight: bold ? 800 : 600,
            fontStyle: italic ? 'italic' : 'normal',
            color: preset.color,
            textShadow,
            ...(preset.background
              ? {
                  backgroundColor: hexToRgba(preset.background, bgOpacity),
                  padding: '0.15em 0.5em',
                  borderRadius: '0.25em',
                  boxDecorationBreak: 'clone' as const,
                  WebkitBoxDecorationBreak: 'clone' as const,
                }
              : {}),
          }}
        >
          {karaoke
            ? words.map((w, i) => (
                <span
                  key={i}
                  style={i < 2 ? { color: '#7c5cff' } : undefined}
                >
                  {w}
                  {i < words.length - 1 ? ' ' : ''}
                </span>
              ))
            : SAMPLE}
        </div>
      </div>
    </div>
  )
}
