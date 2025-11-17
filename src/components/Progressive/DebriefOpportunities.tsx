import { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { CitationToken } from '../shared/CitationOverlay'
import { useDashboard } from '../../context/DashboardContext'
import LoadingSpinner from '../Common/LoadingSpinner'

export default function DebriefOpportunities() {
  const { concept, persona, region } = useDashboard() as any
  // tabs removed; show both sections
  const [debrief, setDebrief] = useState<{ brief: string; summary: string; keyPoints: string[]; didYouKnow: string[]; sources?: any } | null>(null)
  const [opps, setOpps] = useState<{ opportunities: { title: string; why: string; impact: number }[]; rationale?: string; sources?: any } | null>(null)
  const [loading, setLoading] = useState(false)
  const [asOf, setAsOf] = useState<string>('')
  const [integrated, setIntegrated] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancel = false
    if (!concept) return
    setLoading(true)
    ;(async () => {
      try {
        const [d, o] = await Promise.all([
          api.debrief(concept, { persona, region }),
          api.opportunities(concept, { persona, region })
        ])
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
        <div className="text-[11px] text-white/50 flex items-center gap-2">
          {asOf && <span>As of {asOf}</span>}
          {/* Persona attribution */}
          {(() => { try { const p = JSON.parse(localStorage.getItem('persona')||'""'); return p ? <span>Persona considered: {p}</span> : null } catch { return null } })()}
        </div>
      </div>
      {loading && (
        <LoadingSpinner text="Analyzing concept and context… generating debrief and ranked opportunities." />
      )}
      {!loading && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3 text-sm">
            <div className="text-white/80">{debrief?.brief || 'Generating debrief…'}</div>
            <div className="text-xs text-white/50">{debrief?.summary || ''}</div>
            <div>
              <div className="text-xs text-white/60 mb-1">Key Points</div>
              <ul className="list-disc pl-5 space-y-1">
                {(debrief?.keyPoints || []).map((p,i)=>{
                  // Map first two points to top trend references when available
                  const core = (debrief?.sources?.core || []) as string[]
                  const trends = core.filter(x => x.startsWith('trend:')).map(x => x.replace('trend:',''))
                  const t = trends[i]
                  return (
                    <li key={i} className="text-white/80">
                      {p}
                      {t && i < 2 && (
                        <span className="ml-1 align-middle"><CitationToken id={i+1} label={`Trend: ${t}`} detail={`Referenced trend: ${t}`} /></span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          <div className="panel p-3 bg-ralph-teal/15 border border-ralph-teal/30">
            <div className="text-xs text-white/70 mb-1">Did You Know</div>
            <div className="flex flex-wrap gap-2">
              {debrief?.didYouKnow?.map((x,i)=>(
                <span key={i} className="px-2 py-1 rounded bg-white/10 border border-white/20 text-xs">
                  {x} <span className="ml-1 align-middle text-ralph-pink">[{i+1}]</span>
                </span>
              ))}
            </div>
          </div>
          <Attribution sources={debrief?.sources} />
        </div>
        <div className="space-y-2 text-sm">
          {opps?.opportunities?.map((o,i)=>{
            const isIntegrated = integrated.has(o.title)
            return (
            <div key={i} className="panel p-2">
              <div className="flex items-center justify-between">
                <div className="font-medium text-white/90">{o.title}</div>
                <div className="text-xs px-2 py-0.5 rounded border border-white/10 bg-white/5">Impact {o.impact}</div>
              </div>
              <div className="text-white/70 text-xs mt-1">
                {o.why}
                {(() => {
                  const core = (opps?.sources?.core || []) as string[]
                  const trends = core.filter(x => x.startsWith('trend:')).map(x => x.replace('trend:',''))
                  const match = trends.find(t => o.title.toLowerCase().includes(t.toLowerCase()))
                  if (match && (window as any).__registerCitation) {
                    const id = (window as any).__registerCitation('Trend', `Opportunity informed by trend: ${match}`)
                    return id ? <span className="ml-1 align-middle"><CitationToken id={id} label="Trend" detail={`Opportunity informed by trend: ${match}`} /></span> : null
                  }
                  if ((opps?.sources?.user || []).length && (window as any).__registerCitation) {
                    const id = (window as any).__registerCitation('Your KB', 'Opportunity informed by your uploaded knowledge base')
                    return id ? <span className="ml-1 align-middle"><CitationToken id={id} label="Your KB" detail="Opportunity informed by your uploaded knowledge base" /></span> : null
                  }
                  return null
                })()}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => { integrateOpportunity(o); setIntegrated(s => new Set(s).add(o.title)) }}
                  className={`text-[11px] px-2 py-1 rounded border ${isIntegrated ? 'border-ralph-teal/40 bg-ralph-teal/20 text-white/90' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                  disabled={isIntegrated}
                >
                  {isIntegrated ? 'Added to Narrative' : 'Integrate'}
                </button>
              </div>
            </div>
            )
          })}
          {opps?.rationale && <div className="text-xs text-white/50">{opps.rationale}</div>}
          <Attribution sources={opps?.sources} />
          <div className="text-[11px] text-white/60 mt-2">
            <button onClick={() => { try { window.dispatchEvent(new CustomEvent('open-citation', { detail: { id: 'all' } })) } catch {} }} className="underline hover:text-white/80">View all citations</button>
          </div>
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

function integrateOpportunity(o: { title: string; why: string; impact: number }) {
  try {
    const target = guessTarget(o.title)
    const targetLabel = target ? ` to ${target.charAt(0).toUpperCase() + target.slice(1)}` : ''

    // Apply to narrative framework if target found
    if (target) window.dispatchEvent(new CustomEvent('nf-apply', { detail: { target, text: o.title } }))

    // Co-pilot confirmation message
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('copilot-say', {
        detail: { text: `Added "${o.title}"${targetLabel}. ${o.why} This will update the narrative structure and concept proposal.` }
      }))
    }, 100)

    window.dispatchEvent(new CustomEvent('conversation-updated'))
    window.dispatchEvent(new CustomEvent('debrief-interaction'))
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
