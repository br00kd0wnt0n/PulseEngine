import { useCreators } from '../../context/CreatorContext'
import { useTrends } from '../../context/TrendContext'
import { useDashboard } from '../../context/DashboardContext'
import { useMemo, useState } from 'react'

export default function CreatorPanel() {
  const { recommended } = useCreators()
  const { selected } = useTrends()
  const { concept } = useDashboard()
  const [expanded, setExpanded] = useState(false)
  const projectType = useMemo(() => deriveProjectType(concept || ''), [concept])
  const list = expanded ? recommended : recommended.slice(0, 3)

  return (
    <div className="panel module p-4 transform-gpu">
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold">Need a creative partner?</div>
        {!expanded && recommended.length > 3 && (
          <button className="text-[11px] px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setExpanded(true)}>Show more</button>
        )}
        {expanded && (
          <button className="text-[11px] px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setExpanded(false)}>Show less</button>
        )}
      </div>
      <div className="text-xs text-white/60 mb-3">Here are some top matches for this {projectType} project.</div>
      <div className="grid lg:grid-cols-1 md:grid-cols-2 gap-3">
        {list.map(c => {
          const why = explainWhyMatch(selected?.kind === 'trend' ? selected.label : undefined, c as any)
          return (
          <div key={c.id} className="flex items-start gap-3 p-3 rounded border border-white/10 bg-charcoal-800/50">
            <div className="h-9 w-9 rounded-full bg-ralph-purple/30 border border-white/10" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{c.name}</div>
              <div className="text-xs text-white/60 truncate">{c.platform} • {c.category}</div>
              <div className="text-[11px] text-white/60 mt-1">{why}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/50">Res</div>
              <div className="font-semibold text-sm">{Math.round(c.resonance)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/50">Collab</div>
              <div className="font-semibold text-sm">{Math.round(c.collaboration)}</div>
            </div>
          </div>
        )})}
      </div>
    </div>
  )
}

function explainWhyMatch(trendLabel: string | undefined, c: any) {
  const tags: string[] = (c.tags || c.metadata?.tags || []).map((x: any) => String(x).toLowerCase())
  const trendWord = trendLabel ? trendLabel.split(' ')[0] : undefined
  const overlaps = [trendWord, 'dance','challenge','ai','retro','tutorial','loop','remix','gaming','fashion'].filter(Boolean).filter(w => tags.includes((w as string).toLowerCase()))
  const parts = [] as string[]
  if (overlaps.length) parts.push(`Tags overlap: ${overlaps.slice(0,2).join('/')}`)
  if (typeof c.collaboration === 'number') parts.push(`High collab: ${Math.round(c.collaboration)}`)
  return parts.join(' • ') || 'Strong creative fit'
}

function deriveProjectType(concept: string) {
  const lc = concept.toLowerCase()
  if (lc.includes('dance')) return 'dance'
  if (lc.includes('retro') || lc.includes('nostalgia')) return 'nostalgia remix'
  if (lc.includes('tutorial') || lc.includes('how')) return 'tutorial'
  if (lc.includes('gaming')) return 'gaming edit'
  if (lc.includes('fashion') || lc.includes('streetwear') || lc.includes('lookbook')) return 'lookbook'
  if (lc.includes('ai') && lc.includes('music')) return 'AI music'
  return 'story'
}
