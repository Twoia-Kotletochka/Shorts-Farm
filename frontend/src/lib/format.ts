/** Форматирование значений для UI (RU-локаль). */

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Секунды → «M:SS» или «H:MM:SS». */
export function formatDuration(totalSec: number | null | undefined): string {
  if (totalSec == null || !isFinite(totalSec)) return '—'
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`
  return `${m}:${pad(sec)}`
}

/** Секунды → таймкод «HH:MM:SS» (опц. с десятыми «.s»). */
export function formatTimecode(totalSec: number | null | undefined, withTenths = false): string {
  if (totalSec == null || !isFinite(totalSec)) return '—'
  const s = Math.max(0, totalSec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const base = `${pad(h)}:${pad(m)}:${pad(sec)}`
  if (!withTenths) return base
  const tenths = Math.floor((s - Math.floor(s)) * 10)
  return `${base}.${tenths}`
}

/** Байты → человекочитаемо. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !isFinite(bytes)) return '—'
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

/** ГБ → «12.3 ГБ» / «1.2 ТБ». */
export function formatGb(gb: number | null | undefined): string {
  if (gb == null || !isFinite(gb)) return '—'
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} ТБ`
  return `${gb.toFixed(gb >= 100 ? 0 : 1)} ГБ`
}

/** ISO datetime → «29.06.2026, 14:30». */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** ISO → относительное «5 мин назад», «вчера». */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  const sec = Math.round(diff / 1000)
  if (sec < 60) return 'только что'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} ${plural(min, 'минуту', 'минуты', 'минут')} назад`
  const hrs = Math.round(min / 60)
  if (hrs < 24) return `${hrs} ${plural(hrs, 'час', 'часа', 'часов')} назад`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`
  return formatDateTime(iso)
}

/** Русское склонение по числу. plural(2,'файл','файла','файлов') → 'файла'. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

/** Доля 0..1 → проценты «73%». */
export function formatPct(v: number | null | undefined, digits = 0): string {
  if (v == null || !isFinite(v)) return '—'
  return `${(v * 100).toFixed(digits)}%`
}

/** Рейтинг 0..1 → целое 0..100 для крупного балла. */
export function ratingTo100(v: number | null | undefined): number {
  if (v == null || !isFinite(v)) return 0
  return Math.round(Math.max(0, Math.min(1, v)) * 100)
}
