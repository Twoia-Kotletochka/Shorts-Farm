import { describe, it, expect } from 'vitest'
import {
  ratingTo100,
  ratingFraction,
  formatDuration,
  formatTimecode,
  formatGb,
  plural,
} from '@/lib/format'

describe('format helpers', () => {
  it('ratingTo100 — шкала 0..100 (округление + клампинг)', () => {
    expect(ratingTo100(71.4)).toBe(71)
    expect(ratingTo100(100)).toBe(100)
    expect(ratingTo100(120)).toBe(100)
    expect(ratingTo100(-5)).toBe(0)
    expect(ratingTo100(null)).toBe(0)
  })

  it('ratingFraction — доля 0..1 из 0..100', () => {
    expect(ratingFraction(78)).toBeCloseTo(0.78)
    expect(ratingFraction(0)).toBe(0)
    expect(ratingFraction(200)).toBe(1)
    expect(ratingFraction(undefined)).toBe(0)
  })

  it('formatDuration', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3661)).toBe('1:01:01')
    expect(formatDuration(null)).toBe('—')
  })

  it('formatTimecode', () => {
    expect(formatTimecode(65)).toBe('00:01:05')
    expect(formatTimecode(65.5, true)).toBe('00:01:05.5')
  })

  it('formatGb', () => {
    expect(formatGb(318)).toBe('318 ГБ')
    expect(formatGb(1.2)).toBe('1.2 ГБ')
    expect(formatGb(2048)).toBe('2.0 ТБ')
    expect(formatGb(null)).toBe('—')
  })

  it('plural — русское склонение', () => {
    expect(plural(1, 'ролик', 'ролика', 'роликов')).toBe('ролик')
    expect(plural(2, 'ролик', 'ролика', 'роликов')).toBe('ролика')
    expect(plural(5, 'ролик', 'ролика', 'роликов')).toBe('роликов')
    expect(plural(11, 'ролик', 'ролика', 'роликов')).toBe('роликов')
    expect(plural(21, 'ролик', 'ролика', 'роликов')).toBe('ролик')
  })
})
