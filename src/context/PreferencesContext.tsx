import { createContext, useContext } from 'react'

export type Preferences = {
  persona: 'Social Strategist' | 'Creator' | 'Analyst'
  platforms: string[]
  areasOfInterest: string[]
  kpis: string[]
}

const defaultPrefs: Preferences = {
  persona: 'Social Strategist',
  platforms: ['TikTok', 'YouTube Shorts', 'Instagram Reels'],
  areasOfInterest: ['Dance Challenges', 'AI Music', 'Short-form Edits'],
  kpis: ['Narrative Potential', 'Collaboration Opportunity', 'Time to Peak'],
}

const PrefCtx = createContext<Preferences>(defaultPrefs)

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  // Mocked as static for now; can be replaced with persisted user prefs later
  return <PrefCtx.Provider value={defaultPrefs}>{children}</PrefCtx.Provider>
}

export function usePreferences() { return useContext(PrefCtx) }

