import { useMemo } from 'react'
import { usePreferences } from '../../context/PreferencesContext'
import { useTrends } from '../../context/TrendContext'

export default function AtAGlance() {
  const prefs = usePreferences()
  const { nodes, links } = useTrends()

  const counts = useMemo(() => {
    const trends = nodes.filter(n => n.kind === 'trend')
    const creators = nodes.filter(n => n.kind === 'creator')
    const content = nodes.filter(n => n.kind === 'content')
    return { trends: trends.length, creators: creators.length, content: content.length, links: links.length }
  }, [nodes, links])

  return (
    <div className="panel module p-4 transform-gpu">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Overview at a Glance</div>
        <div className="text-xs text-white/60">{prefs.persona} preset</div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Active Trends" value={counts.trends} hint="aligned to interests" />
        <Card label="Creators" value={counts.creators} hint="collab-ready" />
        <Card label="Content Types" value={counts.content} hint="formats" />
        <Card label="Connections" value={counts.links} hint="ecosystem" />
      </div>
      <div className="mt-4">
        <div className="text-xs text-white/60 mb-2">Focus Areas</div>
        <div className="flex flex-wrap gap-2">
          {prefs.areasOfInterest.map(a => <span key={a} className="px-2 py-1 rounded border border-white/10 text-xs bg-charcoal-700/40">{a}</span>)}
        </div>
      </div>
      <div className="mt-3">
        <div className="text-xs text-white/60 mb-2">Primary Platforms</div>
        <div className="flex flex-wrap gap-2">
          {prefs.platforms.map(p => <span key={p} className="px-2 py-1 rounded border border-white/10 text-xs bg-ralph-purple/20">{p}</span>)}
        </div>
      </div>
    </div>
  )
}

function Card({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="panel p-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      {hint && <div className="text-[10px] text-white/50">{hint}</div>}
    </div>
  )
}
