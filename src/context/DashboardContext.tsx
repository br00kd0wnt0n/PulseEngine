import { createContext, useContext, useState } from 'react'

type Ctx = {
  concept: string
  setConcept: (v: string) => void
  activated: boolean
  setActivated: (v: boolean) => void
}

const DashCtx = createContext<Ctx | null>(null)

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [concept, setConcept] = useState('')
  const [activated, setActivated] = useState(false)
  return (
    <DashCtx.Provider value={{ concept, setConcept, activated, setActivated }}>
      {children}
    </DashCtx.Provider>
  )
}

export function useDashboard() {
  const v = useContext(DashCtx)
  if (!v) throw new Error('DashboardContext missing')
  return v
}

