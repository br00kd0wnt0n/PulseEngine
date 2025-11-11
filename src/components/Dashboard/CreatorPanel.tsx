import { useCreators } from '../../context/CreatorContext'
import { useTrends } from '../../context/TrendContext'

export default function CreatorPanel() {
  const { recommended } = useCreators()
  const { selected } = useTrends()
  return (
    <div className="panel module p-4 transform-gpu">
      <div className="font-semibold mb-3">Creator Intelligence</div>
      <div className="grid lg:grid-cols-1 md:grid-cols-2 gap-3">
        {recommended.map(c => {
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
