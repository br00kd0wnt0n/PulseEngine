import { useMemo } from 'react'
import { useTrends } from '../../context/TrendContext'

export default function RelevantTrends() {
  const { snapshot } = useTrends() as any
  const trends = useMemo(() => (snapshot().nodes || []).filter((n: any) => n.kind === 'trend').slice(0, 10), [snapshot])
  return (
    <div className="panel p-3">
      <div className="text-xs text-white/60 mb-1">Relevant Trends</div>
      <div className="flex flex-wrap gap-2 text-xs">
        {trends.length ? trends.map((t: any) => (
          <span key={t.id} className="px-2 py-1 rounded bg-white/5 border border-white/10">{t.label}</span>
        )) : <span className="text-white/50">No trends detected</span>}
      </div>
    </div>
  )
}

