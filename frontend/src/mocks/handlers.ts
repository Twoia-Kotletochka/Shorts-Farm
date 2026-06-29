import { http, HttpResponse, delay } from 'msw'
import * as db from './db'
import { API_BASE } from '@/api/http'
import type { JobParams } from '@/types/api'

const url = (path: string) => `${API_BASE}${path}`
const SLOW = 250

// 9:16 SVG-превью для шортса (вместо реального видео в mock-режиме).
function thumbSvg(id: number): string {
  const short = db.getShort(id)
  const hue = (id * 47) % 360
  const title = (short?.hook_title ?? 'Превью').slice(0, 40)
  const cat = short?.category ?? ''
  const score = short ? Math.round(short.rating.overall * 100) : 0
  return `<svg xmlns="http://www.w3.org/2000/svg" width="270" height="480" viewBox="0 0 270 480">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 55% 22%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 40) % 360} 60% 10%)"/>
    </linearGradient>
  </defs>
  <rect width="270" height="480" fill="url(#g)"/>
  <circle cx="135" cy="200" r="34" fill="rgba(255,255,255,0.12)"/>
  <path d="M126 184 l24 16 -24 16 z" fill="rgba(255,255,255,0.85)"/>
  <rect x="14" y="14" width="58" height="22" rx="11" fill="rgba(0,0,0,0.45)"/>
  <text x="43" y="29" font-family="Inter,sans-serif" font-size="12" fill="#fff" text-anchor="middle">★ ${score}</text>
  <text x="16" y="420" font-family="Inter,sans-serif" font-size="11" fill="rgba(255,255,255,0.65)">${cat}</text>
  <text x="16" y="444" font-family="Inter,sans-serif" font-size="15" font-weight="600" fill="#fff">${title}</text>
</svg>`
}

export const handlers = [
  // ── Дашборд ──
  http.get(url('/health'), async () => {
    await delay(SLOW)
    return HttpResponse.json(db.getHealth())
  }),
  http.get(url('/usage'), async () => {
    await delay(SLOW)
    return HttpResponse.json(db.getUsage())
  }),
  http.get(url('/stats'), async () => {
    await delay(SLOW)
    return HttpResponse.json(db.getStats())
  }),

  // ── Библиотека ──
  http.post(url('/library/scan'), async () => {
    await delay(800)
    return HttpResponse.json(db.scanLibrary())
  }),
  http.get(url('/movies'), async () => {
    await delay(SLOW)
    return HttpResponse.json(db.listMovies())
  }),
  http.get(url('/movies/:id'), async ({ params }) => {
    const m = db.getMovie(Number(params.id))
    return m ? HttpResponse.json(m) : HttpResponse.json({ detail: 'Фильм не найден' }, { status: 404 })
  }),
  http.delete(url('/movies/:id'), async ({ params }) => {
    db.removeMovie(Number(params.id))
    return HttpResponse.json({ ok: true })
  }),

  // ── Задачи ──
  http.post(url('/jobs'), async ({ request }) => {
    await delay(SLOW)
    const body = (await request.json()) as JobParams
    return HttpResponse.json({ job_id: db.createJob(body) })
  }),
  http.get(url('/jobs'), async () => {
    await delay(150)
    return HttpResponse.json(db.listJobs())
  }),
  http.get(url('/jobs/:id'), async ({ params }) => {
    const j = db.getJob(Number(params.id))
    return j ? HttpResponse.json(j) : HttpResponse.json({ detail: 'Задача не найдена' }, { status: 404 })
  }),
  http.post(url('/jobs/:id/cancel'), async ({ params }) => {
    db.cancelJob(Number(params.id))
    return HttpResponse.json({ ok: true })
  }),
  http.patch(url('/jobs/:id/priority'), async ({ params, request }) => {
    const { priority } = (await request.json()) as { priority: number }
    db.setPriority(Number(params.id), priority)
    return HttpResponse.json({ ok: true })
  }),
  http.post(url('/jobs/:id/repeat'), async ({ params }) => {
    return HttpResponse.json({ job_id: db.repeatJob(Number(params.id)) })
  }),
  http.post(url('/jobs/estimate'), async ({ request }) => {
    await delay(SLOW)
    const body = (await request.json()) as JobParams
    const movie = db.getMovie(body.movie_id)
    const usage = db.getUsage()
    if (!usage.stt.has_limits) return HttpResponse.json({ unlimited: true })
    const needed = Math.round(movie?.duration ?? 3600)
    const remaining = (usage.stt.limit ?? 0) - (usage.stt.used ?? 0)
    return HttpResponse.json({
      whisper_audio_sec_needed: needed,
      fits_today: needed <= remaining,
    })
  }),
  http.post(url('/jobs/batch'), async ({ request }) => {
    await delay(SLOW)
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ job_ids: db.batchJobs(body) })
  }),

  // ── Шортсы ──
  http.get(url('/shorts'), async ({ request }) => {
    await delay(SLOW)
    const sp = new URL(request.url).searchParams
    return HttpResponse.json(
      db.listShorts({
        status: sp.get('status') ?? undefined,
        movie_id: sp.get('movie_id') ? Number(sp.get('movie_id')) : undefined,
        sort: sp.get('sort') ?? undefined,
      }),
    )
  }),
  http.get(url('/shorts/:id'), async ({ params }) => {
    const s = db.getShort(Number(params.id))
    return s ? HttpResponse.json(s) : HttpResponse.json({ detail: 'Шортс не найден' }, { status: 404 })
  }),
  http.get(url('/shorts/:id/metadata'), async ({ params }) => {
    const m = db.getShortMetadata(Number(params.id))
    return m ? HttpResponse.json(m) : HttpResponse.json({ detail: 'нет' }, { status: 404 })
  }),
  http.get(url('/shorts/:id/subtitles'), async ({ params }) => {
    return HttpResponse.json(db.getShortSubtitles(Number(params.id)))
  }),
  http.get(url('/shorts/:id/thumbnail'), async ({ params }) => {
    return new HttpResponse(thumbSvg(Number(params.id)), {
      headers: { 'Content-Type': 'image/svg+xml' },
    })
  }),
  // Реального видео в mock-режиме нет — отдаём 204 (плеер показывает постер-превью).
  http.get(url('/shorts/:id/preview'), () => new HttpResponse(null, { status: 204 })),
  http.get(url('/shorts/:id/file'), () => new HttpResponse(null, { status: 204 })),
  http.post(url('/shorts/:id/approve'), async ({ params }) => {
    await delay(600)
    db.approveShort(Number(params.id))
    return HttpResponse.json({ ok: true })
  }),
  http.post(url('/shorts/:id/reject'), async ({ params }) => {
    db.rejectShort(Number(params.id))
    return HttpResponse.json({ ok: true })
  }),
  http.delete(url('/shorts/:id'), async ({ params }) => {
    db.removeShort(Number(params.id))
    return HttpResponse.json({ ok: true })
  }),
  http.patch(url('/shorts/:id'), async ({ params, request }) => {
    const body = (await request.json()) as {
      start_ts?: number
      end_ts?: number
      subtitles_text?: string
    }
    db.patchShort(Number(params.id), body)
    return HttpResponse.json(db.getShort(Number(params.id)))
  }),
  http.post(url('/shorts/bulk'), async ({ request }) => {
    const { ids, action } = (await request.json()) as {
      ids: number[]
      action: 'approve' | 'reject' | 'delete'
    }
    db.bulkShorts(ids, action)
    return HttpResponse.json({ ok: true })
  }),

  // ── Пресеты субтитров ──
  http.get(url('/subtitle-presets'), async () => HttpResponse.json(db.listPresets())),
  http.post(url('/subtitle-presets'), async ({ request }) =>
    HttpResponse.json(db.createPreset((await request.json()) as never)),
  ),
  http.put(url('/subtitle-presets/:id'), async ({ params, request }) =>
    HttpResponse.json(db.updatePreset(Number(params.id), (await request.json()) as never)),
  ),
  http.delete(url('/subtitle-presets/:id'), async ({ params }) => {
    db.deletePreset(Number(params.id))
    return HttpResponse.json({ ok: true })
  }),

  // ── Профили ──
  http.get(url('/profiles'), async () => HttpResponse.json(db.listProfiles())),
  http.post(url('/profiles'), async ({ request }) =>
    HttpResponse.json(db.createProfile((await request.json()) as never)),
  ),
  http.put(url('/profiles/:id'), async ({ params, request }) =>
    HttpResponse.json(db.updateProfile(Number(params.id), (await request.json()) as never)),
  ),
  http.delete(url('/profiles/:id'), async ({ params }) => {
    db.deleteProfile(Number(params.id))
    return HttpResponse.json({ ok: true })
  }),

  // ── Категории ──
  http.get(url('/categories'), async () => HttpResponse.json(db.listCategories())),
  http.post(url('/categories'), async ({ request }) =>
    HttpResponse.json(db.createCategory((await request.json()) as never)),
  ),
  http.put(url('/categories/:id'), async ({ params, request }) =>
    HttpResponse.json(db.updateCategory(Number(params.id), (await request.json()) as never)),
  ),
  http.delete(url('/categories/:id'), async ({ params }) => {
    db.deleteCategory(Number(params.id))
    return HttpResponse.json({ ok: true })
  }),

  // ── Настройки / провайдеры ──
  http.get(url('/settings'), async () => {
    await delay(SLOW)
    return HttpResponse.json(db.getSettings())
  }),
  http.put(url('/settings'), async ({ request }) => {
    await delay(SLOW)
    return HttpResponse.json(db.updateSettings((await request.json()) as never))
  }),
  http.post(url('/providers/test'), async ({ request }) => {
    await delay(700)
    const body = (await request.json()) as {
      kind: 'llm' | 'stt'
      config: { type: string; api_key?: string | null }
    }
    const needsKey = body.config.type !== 'ollama'
    if (needsKey && !body.config.api_key) {
      return HttpResponse.json({ ok: false, error: 'Не указан API-ключ.' })
    }
    return HttpResponse.json({ ok: true })
  }),

  // ── Бэкап / конфиг ──
  http.post(url('/backup'), async () => {
    await delay(600)
    return HttpResponse.json({ ok: true, file: `backups/db-${Date.now()}.sqlite` })
  }),
  http.get(url('/config/export'), async () => HttpResponse.json(db.exportConfig())),
  http.post(url('/config/import'), async () => HttpResponse.json({ ok: true })),
]
