import { describe, it, expect, beforeEach } from 'vitest'
import { mediaUrl, setPanelKey, getPanelKey } from '@/api/http'

describe('mediaUrl + ключ панели', () => {
  beforeEach(() => setPanelKey(null))

  it('без ключа и query', () => {
    expect(mediaUrl('/shorts/1/preview')).toBe('/api/shorts/1/preview')
  })

  it('добавляет ?v= для cache-busting', () => {
    expect(mediaUrl('/shorts/1/preview', { v: 5 })).toBe('/api/shorts/1/preview?v=5')
  })

  it('пропускает undefined-параметры', () => {
    expect(mediaUrl('/shorts/1/file', { v: undefined })).toBe('/api/shorts/1/file')
  })

  it('добавляет panel_key при заданном пароле (и комбинирует с v)', () => {
    setPanelKey('secret')
    expect(getPanelKey()).toBe('secret')
    expect(mediaUrl('/shorts/1/thumbnail')).toBe('/api/shorts/1/thumbnail?panel_key=secret')
    expect(mediaUrl('/shorts/1/preview', { v: 3 })).toBe(
      '/api/shorts/1/preview?v=3&panel_key=secret',
    )
  })

  it('setPanelKey(null) очищает ключ', () => {
    setPanelKey('x')
    setPanelKey(null)
    expect(getPanelKey()).toBeNull()
    expect(mediaUrl('/shorts/1/preview')).toBe('/api/shorts/1/preview')
  })
})
