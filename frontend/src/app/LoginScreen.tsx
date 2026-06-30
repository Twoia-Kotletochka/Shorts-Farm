import { useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'
import { Button, Field, Input } from '@/components/ui'
import { apiErrorMessage } from '@/api/http'
import { useAuth } from './auth'

export function LoginScreen() {
  const { login } = useAuth()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!password) return
    setBusy(true)
    setError(null)
    try {
      await login(password)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-surface p-6 shadow-elev"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-content">Shorts Farm</h1>
          <p className="text-sm text-content-muted">Панель защищена паролем</p>
        </div>
        <Field error={error ?? undefined}>
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            placeholder="Пароль панели"
            invalid={!!error}
          />
        </Field>
        <Button type="submit" className="w-full" loading={busy} disabled={!password}>
          Войти
        </Button>
      </form>
    </div>
  )
}
