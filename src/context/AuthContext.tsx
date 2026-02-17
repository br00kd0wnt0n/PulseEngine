import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api, AuthUser } from '../services/api'

type AuthCtx = {
  user: AuthUser | null
  loading: boolean
  login: (credential: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('pulse_user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  // Validate stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('pulse_token')
    if (!token) { setLoading(false); setUser(null); return }

    api.authMe()
      .then(({ user: u }) => {
        setUser(u)
        localStorage.setItem('pulse_user', JSON.stringify(u))
      })
      .catch(() => {
        localStorage.removeItem('pulse_token')
        localStorage.removeItem('pulse_user')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  // Listen for 401 auto-logout events from api.ts
  useEffect(() => {
    const onLogout = () => { setUser(null) }
    window.addEventListener('auth-logout', onLogout)
    return () => window.removeEventListener('auth-logout', onLogout)
  }, [])

  const login = useCallback(async (credential: string) => {
    const { token, user: u } = await api.authGoogle(credential)
    localStorage.setItem('pulse_token', token)
    localStorage.setItem('pulse_user', JSON.stringify(u))
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('pulse_token')
    localStorage.removeItem('pulse_user')
    setUser(null)
  }, [])

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('AuthContext missing')
  return v
}
