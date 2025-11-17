import { createContext, useContext, useMemo, useRef, useState } from 'react'

export type CitationItem = { id: number; label: string; detail: string }

type Ctx = {
  citations: CitationItem[]
  register: (label: string, detail: string) => number
  clear: () => void
}

const CitCtx = createContext<Ctx | null>(null)

export function CitationProvider({ children }: { children: React.ReactNode }) {
  const [citations, setCitations] = useState<CitationItem[]>([])
  const nextIdRef = useRef(1)

  const api = useMemo<Ctx>(() => ({
    citations,
    register: (label: string, detail: string) => {
      // de-duplicate by label+detail
      const found = citations.find(c => c.label === label && c.detail === detail)
      if (found) return found.id
      const id = nextIdRef.current++
      setCitations(prev => [...prev, { id, label, detail }])
      return id
    },
    clear: () => { setCitations([]); nextIdRef.current = 1 },
  }), [citations])

  return <CitCtx.Provider value={api}>{children}</CitCtx.Provider>
}

export function useCitations() {
  const v = useContext(CitCtx)
  if (!v) throw new Error('CitationContext missing')
  return v
}

