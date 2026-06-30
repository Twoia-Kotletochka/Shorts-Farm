import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { getAuthStatus, login as apiLogin } from '@/api/endpoints'
import { getPanelKey, setPanelKey, setUnauthorizedHandler } from '@/api/http'

type AuthState = 'checking' | 'login' | 'ready'

interface AuthContextValue {
  state: AuthState
  login: (password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth вызван вне AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('checking')

  const logout = useCallback(() => {
    setPanelKey(null)
    setState('login')
  }, [])

  const login = useCallback(async (password: string) => {
    await apiLogin(password) // бросит 401 при неверном пароле — поймает форма входа
    setPanelKey(password)
    setState('ready')
  }, [])

  // Любой 401 в защищённых запросах → показать экран входа.
  useEffect(() => {
    setUnauthorizedHandler(() => setState('login'))
    return () => setUnauthorizedHandler(null)
  }, [])

  // Стартовая проверка: нужен ли пароль и валиден ли сохранённый ключ.
  useEffect(() => {
    let cancelled = false
    // Не перетираем состояние, если пользователь уже вошёл/разлогинился во время проверки.
    const settle = (next: AuthState) => setState((s) => (s === 'checking' ? next : s))
    async function check() {
      try {
        const { password_required } = await getAuthStatus()
        if (cancelled) return
        if (!password_required) {
          settle('ready')
          return
        }
        const stored = getPanelKey()
        if (stored) {
          try {
            await apiLogin(stored) // валидируем сохранённый ключ
            if (!cancelled) settle('ready')
            return
          } catch {
            setPanelKey(null)
          }
        }
        if (!cancelled) settle('login')
      } catch {
        // /auth/status недоступен (бэкенд лежит) — пускаем в приложение, ошибки покажутся по месту.
        if (!cancelled) settle('ready')
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [])

  return <AuthContext.Provider value={{ state, login, logout }}>{children}</AuthContext.Provider>
}
