import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as db from '@/mocks/db'

describe('mock db — жизненный цикл шортса', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('approve → финал готов после таймера (has_final + рост rev)', () => {
    const draft = db.listShorts({ status: 'draft' })[0]
    expect(draft).toBeTruthy()
    const id = draft!.id
    const revBefore = db.getShort(id)!.rev

    db.approveShort(id)
    let s = db.getShort(id)!
    expect(s.status).toBe('approved')
    expect(s.has_final).toBe(false) // финал ещё рендерится

    vi.advanceTimersByTime(7000) // прошло >6с
    s = db.getShort(id)!
    expect(s.has_final).toBe(true)
    expect(s.rev).toBeGreaterThan(revBefore)
  })

  it('patch → rev растёт после ре-рендера превью', () => {
    const id = db.listShorts()[0]!.id
    const before = db.getShort(id)!.rev
    db.patchShort(id, { end_ts: 999 })
    vi.advanceTimersByTime(3500) // >3с
    expect(db.getShort(id)!.rev).toBeGreaterThan(before)
  })
})

describe('mock db — extra_headers провайдера (Cloudflare Access)', () => {
  const FRIEND = 'p-friend'
  // Заводим у friend-провайдера известные (немаскированные) заголовки — для детерминизма теста.
  function seedFriend(headers: Record<string, string>) {
    const list = db.getSettings().llm_providers.map((p) =>
      p.id === FRIEND ? { ...p, extra_headers: headers } : p,
    )
    db.updateSettings({ llm_providers: list })
  }
  const friendNow = () => db.getSettings().llm_providers.find((p) => p.id === FRIEND)!

  it('GET маскирует значения extra_headers (как api_key)', () => {
    seedFriend({ 'CF-Access-Client-Id': 'raw-id-1234', 'CF-Access-Client-Secret': 'raw-sec-5678' })
    const f = friendNow()
    expect(f.extra_headers!['CF-Access-Client-Id']).toBe('****1234')
    expect(f.extra_headers!['CF-Access-Client-Secret']).toBe('****5678')
  })

  it('PUT: маска сохраняет прежнее значение, новое — перезаписывает', () => {
    seedFriend({ 'CF-Access-Client-Id': 'raw-id-1234', 'CF-Access-Client-Secret': 'raw-sec-5678' })
    const masked = friendNow().extra_headers! // оба маскированы
    const list = db.getSettings().llm_providers.map((p) =>
      p.id === FRIEND
        ? {
            ...p,
            extra_headers: {
              'CF-Access-Client-Id': masked['CF-Access-Client-Id']!, // оставляем маску → прежнее
              'CF-Access-Client-Secret': 'brand-new-9999', // новое значение
            },
          }
        : p,
    )
    db.updateSettings({ llm_providers: list })
    const f = friendNow()
    expect(f.extra_headers!['CF-Access-Client-Id']).toBe('****1234') // сохранилось прежнее
    expect(f.extra_headers!['CF-Access-Client-Secret']).toBe('****9999') // перезаписалось
  })

  it('PUT без ключа extra_headers = «не трогать»', () => {
    seedFriend({ 'CF-Access-Client-Id': 'raw-id-1234' })
    const list = db.getSettings().llm_providers.map((p) => {
      if (p.id !== FRIEND) return p
      const copy = { ...p }
      delete copy.extra_headers
      return copy
    })
    db.updateSettings({ llm_providers: list })
    expect(friendNow().extra_headers!['CF-Access-Client-Id']).toBe('****1234')
  })

  it('PUT с extra_headers:{} очищает заголовки', () => {
    seedFriend({ 'CF-Access-Client-Id': 'raw-id-1234' })
    const list = db.getSettings().llm_providers.map((p) =>
      p.id === FRIEND ? { ...p, extra_headers: {} } : p,
    )
    db.updateSettings({ llm_providers: list })
    expect(friendNow().extra_headers).toBeUndefined()
  })
})
