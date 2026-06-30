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
