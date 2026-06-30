import React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from './app/router'
import { queryClient } from './api/queryClient'
import { Toaster, Spinner } from './components/ui'
import { IS_MOCK } from './api/http'
import { AuthProvider, useAuth } from './app/auth'
import { LoginScreen } from './app/LoginScreen'
import './index.css'

/** Гейт авторизации: проверка → вход → приложение. */
function AppGate() {
  const { state } = useAuth()
  if (state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-content-faint">
        <Spinner className="h-7 w-7" />
      </div>
    )
  }
  if (state === 'login') return <LoginScreen />
  return <RouterProvider router={router} />
}

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
        <AuthProvider>
          <AppGate />
        </AuthProvider>
        <Toaster />
      </QueryClientProvider>
    </React.StrictMode>,
  )
}

void bootstrap()
