import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

/** Запуск MSW. Вызывается в main.tsx только когда VITE_API_MOCK=1. */
export async function startMocks() {
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
}
