import { useEffect, useRef } from 'react'

type HotkeyHandler = (e: KeyboardEvent) => void
type HotkeyMap = Record<string, HotkeyHandler>

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  )
}

/**
 * Глобальные хоткеи. Ключи — это `e.key` в нижнем регистре (например 'j', 'k', 'a', 'r',
 * 'arrowleft'). Игнорируются, когда фокус в поле ввода. `enabled` отключает слушатель.
 */
export function useHotkeys(map: HotkeyMap, enabled = true): void {
  const mapRef = useRef(map)
  mapRef.current = map

  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const handler = mapRef.current[e.key.toLowerCase()]
      if (handler) {
        handler(e)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
