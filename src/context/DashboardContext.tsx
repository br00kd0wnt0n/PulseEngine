import { createContext, useContext, useState } from 'react'

type Ctx = {
  concept: string
  setConcept: (v: string) => void
  activated: boolean
  setActivated: (v: boolean) => void
  frameworkScores: { market: number; narrative: number; commercial: number } | null
  setFrameworkScores: (v: { market: number; narrative: number; commercial: number } | null) => void
  keyDrivers: string[] | null
  setKeyDrivers: (v: string[] | null) => void
  recsDensity: { narrative: number; content: number; platform: number; collab: number } | null
  setRecsDensity: (v: { narrative: number; content: number; platform: number; collab: number } | null) => void
  region: 'US' | 'UK' | 'US+UK' | 'Worldwide'
  setRegion: (v: 'US' | 'UK' | 'US+UK' | 'Worldwide') => void
  persona: 'Social Strategist' | 'Creative Lead' | 'Content Creator'
  setPersona: (v: 'Social Strategist' | 'Creative Lead' | 'Content Creator') => void
}

const DashCtx = createContext<Ctx | null>(null)

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [concept, setConcept] = useState('')
  const [activated, setActivated] = useState(false)
  const [frameworkScores, setFrameworkScores] = useState<Ctx['frameworkScores']>(null)
  const [keyDrivers, setKeyDrivers] = useState<Ctx['keyDrivers']>(null)
  const [recsDensity, setRecsDensity] = useState<Ctx['recsDensity']>(null)
  const [region, setRegionState] = useState<Ctx['region']>(() => {
    try { return (JSON.parse(localStorage.getItem('region') || '"Worldwide"')) as Ctx['region'] } catch { return 'Worldwide' }
  })
  const [persona, setPersonaState] = useState<Ctx['persona']>(() => {
    try { return (JSON.parse(localStorage.getItem('persona') || '"Social Strategist"')) as Ctx['persona'] } catch { return 'Social Strategist' }
  })

  // Wrap setters to persist to localStorage
  const setRegion = (v: Ctx['region']) => {
    setRegionState(v)
    try { localStorage.setItem('region', JSON.stringify(v)) } catch {}
  }

  const setPersona = (v: Ctx['persona']) => {
    setPersonaState(v)
    try { localStorage.setItem('persona', JSON.stringify(v)) } catch {}
  }

  return (
    <DashCtx.Provider value={{ concept, setConcept, activated, setActivated, frameworkScores, setFrameworkScores, keyDrivers, setKeyDrivers, recsDensity, setRecsDensity, region, setRegion, persona, setPersona }}>
      {children}
    </DashCtx.Provider>
  )
}

export function useDashboard() {
  const v = useContext(DashCtx)
  if (!v) throw new Error('DashboardContext missing')
  return v
}
