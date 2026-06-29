import React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from './app/router'
import { queryClient } from './api/queryClient'
import { Toaster } from './components/ui'
import { IS_MOCK } from './api/http'
import './index.css'

async function bootstrap() {
  if (IS_MOCK) {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }

  const root = document.getElementById('root')
  if (!root) throw new Error('#root не найден')

  createRoot(root).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </React.StrictMode>,
  )
}

void bootstrap()
