import { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { useDashboard } from '../../context/DashboardContext'

export default function DebriefOpportunities() {
  const { concept } = useDashboard()
  // tabs removed; show both sections
  const [debrief, setDebrief] = useState<{ brief: string; summary: string; keyPoints: string[]; didYouKnow: string[]; sources?: any } | null>(null)
  const [opps, setOpps] = useState<{ opportunities: { title: string; why: string; impact: number }[]; rationale?: string; sources?: any } | null>(null)
  const [loading, setLoading] = useState(false)
  const [asOf, setAsOf] = useState<string>('')

  useEffect(() => {
    let cancel = false
    if (!concept) return
    setLoading(true)
    ;(async () => {
      try {
        const [d, o] = await Promise.all([api.debrief(concept), api.opportunities(concept)])
        if (!cancel) {
          setDebrief(d); setOpps(o); setAsOf(new Date().toLocaleString())
          try {
            const pid = localStorage.getItem('activeProjectId') || 'local'
            localStorage.setItem(`debrief:${pid}`, JSON.stringify(d || {}))
            localStorage.setItem(`opps:${pid}`, JSON.stringify(o || {}))
          } catch {}
        }
      } catch {}
      finally { if (!cancel) setLoading(false) }
    })()
    return () => { cancel = true }
  }, [concept])

  if (!concept) return null

  return (
    <div className="panel module p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">DEBRIEF + OPPORTUNITIES</div>
        {asOf && <div className="text-[11px] text-white/50">As of {asOf}</div>}
      </div>
      {loading && (
        <div className="text-xs text-white/60">Analyzing concept and context… generating debrief and ranked opportunities.</div>
      )}
      {!loading && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3 text-sm">
            <div className="text-white/80">{debrief?.brief || 'Generating debrief…'}</div>
            <div className="text-xs text-white/50">{debrief?.summary || ''}</div>
            <div>
              <div className="text-xs text-white/60 mb-1">Key Points</div>
              <ul className="list-disc pl-5 space-y-1">
                {debrief?.keyPoints?.map((p,i)=>(<li key={i} className="text-white/80">{p}</li>))}
              </ul>
            </div>
          <div className="panel p-3 bg-ralph-teal/15 border border-ralph-teal/30">
            <div className="text-xs text-white/70 mb-1">Did You Know</div>
            <div className="flex flex-wrap gap-2">
              {debrief?.didYouKnow?.map((x,i)=>(<span key={i} className="px-2 py-1 rounded bg-white/10 border border-white/20 text-xs">{x}</span>))}
            </div>
          </div>
          <Attribution sources={debrief?.sources} />
        </div>
        <div className="space-y-2 text-sm">
          {opps?.opportunities?.map((o,i)=>(
            <div key={i} className="panel p-2">
              <div className="flex items-center justify-between">
                <div className="font-medium text-white/90">{o.title}</div>
                <div className="text-xs px-2 py-0.5 rounded border border-white/10 bg-white/5">Impact {o.impact}</div>
              </div>
              <div className="text-white/70 text-xs mt-1">{o.why}</div>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => insertOpportunity(o)} className="text-[11px] px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10">Insert</button>
              </div>
            </div>
          ))}
          {opps?.rationale && <div className="text-xs text-white/50">{opps.rationale}</div>}
          <Attribution sources={opps?.sources} />
        </div>
        </div>
      )}
    </div>
  )
}

function Attribution({ sources }: { sources?: any }) {
  if (!sources) return null
  const trends = (sources.core || []).filter((s: string) => s.startsWith('trend:')).map((s: string) => s.replace('trend:',''))
  const creators = (sources.core || []).filter((s: string) => s.startsWith('creator:')).map((s: string) => s.replace('creator:',''))
  const user = (sources.user || []).length
  const parts: string[] = []
  if (trends.length) parts.push(`Trends: ${trends.slice(0,2).join(', ')}`)
  if (creators.length) parts.push(`Creators: ${creators.slice(0,2).join(', ')}`)
  if (user) parts.push(`Your KB`) // no details to avoid exposure
  if (parts.length === 0) return null
  return (
    <div className="mt-2 text-[11px] text-white/50">Based on {parts.join(' • ')}</div>
  )
}

function insertOpportunity(o: { title: string; why: string; impact: number }) {
  const text = `${o.title} — ${o.why}`
  try {
    window.dispatchEvent(new CustomEvent('copilot-insert', { detail: { text } }))
    const target = guessTarget(o.title)
    if (target) window.dispatchEvent(new CustomEvent('nf-apply', { detail: { target, text: o.title } }))
  } catch {}
}

function guessTarget(title: string): string | null {
  const t = title.toLowerCase()
  if (t.includes('hook')) return 'hook'
  if (t.includes('loop') || t.includes('beat')) return 'arc'
  if (t.includes('caption') || t.includes('proof') || t.includes('evidence')) return 'evidence'
  if (t.includes('resolution') || t.includes('cta') || t.includes('outcome')) return 'resolution'
  if (t.includes('premise') || t.includes('origin')) return 'origin'
  if (t.includes('pivot') || t.includes('moment')) return 'pivots'
  return null
}
