import { createContext, useContext, useMemo, useState } from 'react'
import { Creator } from '../types'
import { useTrends } from './TrendContext'

type Ctx = {
  creators: Creator[]
  recommended: Creator[]
}

const CreatorCtx = createContext<Ctx | null>(null)

export function CreatorProvider({ children }: { children: React.ReactNode }) {
  const { selected } = useTrends()
  const [creators] = useState<Creator[]>(() => mockCreators())

  const recommended = useMemo(() => {
    if (!selected) return creators.slice(0, 6)
    return creators
      .map(c => ({ c, score: c.resonance * 0.6 + c.collaboration * 0.4 + (c.tags.includes(selected.label.toLowerCase()) ? 20 : 0) }))
      .sort((a,b) => b.score - a.score)
      .slice(0, 6)
      .map(x => x.c)
  }, [creators, selected])

  return <CreatorCtx.Provider value={{ creators, recommended }}>{children}</CreatorCtx.Provider>
}

export const useCreators = () => {
  const v = useContext(CreatorCtx)
  if (!v) throw new Error('CreatorContext missing')
  return v
}

function mockCreators(): Creator[] {
  const base: Omit<Creator, 'id'>[] = [
    { name: 'Nova Quinn', platform: 'TikTok', category: 'Comedy', resonance: 82, collaboration: 76, tags: ['comedy','sketch','viral'] },
    { name: 'Echo Vale', platform: 'YouTube', category: 'Tech', resonance: 74, collaboration: 69, tags: ['ai','gadgets','review'] },
    { name: 'Rae Lyric', platform: 'Instagram', category: 'Fashion', resonance: 88, collaboration: 72, tags: ['streetwear','aesthetic','editorial'] },
    { name: 'Kai Drift', platform: 'Twitch', category: 'Gaming', resonance: 79, collaboration: 83, tags: ['gaming','esports','retro'] },
    { name: 'Luna Voss', platform: 'TikTok', category: 'Dance', resonance: 91, collaboration: 70, tags: ['dance','challenge','loop'] },
    { name: 'Milo Crest', platform: 'YouTube', category: 'DIY', resonance: 66, collaboration: 80, tags: ['maker','build','how-to'] },
  ]
  return base.map((c, i) => ({ id: `c${i}`, ...c }))
}

