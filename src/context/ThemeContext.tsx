import { createContext, useContext, useEffect, useState } from 'react'

type ThemeCtx = { dark: boolean; toggle: () => void }
const Ctx = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(true)
  useEffect(() => {
    const root = document.documentElement
    if (dark) root.classList.add('dark')
    else root.classList.remove('dark')
  }, [dark])
  return <Ctx.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>{children}</Ctx.Provider>
}

export const useTheme = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('ThemeContext missing')
  return v
}

