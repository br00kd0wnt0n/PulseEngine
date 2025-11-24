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
  const [oppError, setOppError] = useState<string | null>(null)
  const [debugOpps, setDebugOpps] = useState<boolean>(() => { try { return localStorage.getItem('debug:opps') === '1' } catch { return false } })
  const [loading, setLoading] = useState(false)
  const [asOf, setAsOf] = useState<string>('')
  const [integrated, setIntegrated] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancel = false
    if (!concept) return
    setLoading(true)
    ;(async () => {
      try {
        const pid = localStorage.getItem('activeProjectId') || 'local'
        const [d, o] = await Promise.all([
          api.debrief(concept, { persona, region, projectId: pid }),
          api.opportunities(concept, { persona, region, projectId: pid }).catch(async (e) => { setOppError('Opportunities not available'); throw e })
        ])
        if (!cancel) {
          setDebrief(d); setOpps(o); setAsOf(new Date().toLocaleString()); setOppError(null)
          try {
            localStorage.setItem(`debrief:${pid}`, JSON.stringify(d || {}))
            localStorage.setItem(`opps:${pid}`, JSON.stringify(o || {}))
          } catch {}
          try { if (debugOpps) console.log('[Opps] payload:', o) } catch {}
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
        <div className="font-semibold">DEBRIEF <span className="text-white/30">|</span> OPPORTUNITIES</div>
        <div className="text-[11px] text-white/50 flex items-center gap-2">
          <label className="text-[10px] flex items-center gap-1">
            <input type="checkbox" className="align-middle" checked={debugOpps} onChange={(e)=>{ setDebugOpps(e.target.checked); try { localStorage.setItem('debug:opps', e.target.checked ? '1':'0') } catch {} }} />
            Debug
          </label>
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
              {debrief?.didYouKnow?.map((x,i)=>{
                // Register citation and get ID
                const citationId = (window as any).__registerCitation ? (window as any).__registerCitation('Market Insight', x) : i+1
                return (
                  <span key={i} className="px-2 py-1 rounded bg-white/10 border border-white/20 text-xs">
                    {x} <span className="ml-1 align-middle"><CitationToken id={citationId} label="Market Insight" detail={x} /></span>
                  </span>
                )
              })}
            </div>
          </div>
          <Attribution sources={debrief?.sources} />
        </div>
        <div className="space-y-2 text-sm">
          {oppError && (
            <div className="panel p-2 border border-red-400/20 bg-red-400/10 text-[11px] text-red-200">
              {oppError} <button className="underline ml-1" onClick={()=>{ try { localStorage.removeItem(`opps:${localStorage.getItem('activeProjectId')||'local'}`) } catch {}; window.location.reload() }}>Retry</button>
            </div>
          )}
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
                  className={`text-[11px] px-2 py-1 rounded border transition-all ${isIntegrated ? 'border-ralph-teal/40 bg-ralph-teal/20 text-white/90' : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-ralph-pink/30'}`}
                  disabled={isIntegrated}
                >
                  {isIntegrated ? (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Added to Narrative
                    </span>
                  ) : 'Integrate into Campaign'}
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

    // Apply to narrative framework if target found
    if (target) {
      window.dispatchEvent(new CustomEvent('nf-apply', { detail: { target, text: o.title } }))

      // More specific co-pilot message based on target
      const targetMessages: Record<string, string> = {
        hook: `Added to Opening Hook: "${o.title}". This will be the first thing your audience sees - make it count!`,
        arc: `Added to Narrative Arc: "${o.title}". This shapes how your campaign story unfolds from beginning to end.`,
        evidence: `Added to Supporting Evidence: "${o.title}". This proof point will strengthen your campaign's credibility.`,
        resolution: `Added to Resolution/CTA: "${o.title}". This defines how your campaign wraps up and drives action.`,
        origin: `Added to Campaign Origin: "${o.title}". This sets up the premise and foundation of your story.`,
        pivots: `Added to Pivotal Moments: "${o.title}". This key turning point will create dramatic tension in your narrative.`,
        perspective: `Added to Perspective: "${o.title}". This defines the POV and framing of your campaign story.`
      }

      const specificMessage = targetMessages[target] || `Added "${o.title}" to ${target.charAt(0).toUpperCase() + target.slice(1)}.`

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('copilot-say', {
          detail: { text: `✓ ${specificMessage}\n\n${o.why}\n\nImpact Score: ${o.impact}/10 - Check the Narrative Deconstruction above to see it in context.` }
        }))
      }, 100)
    } else {
      // No target found - inform user
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('copilot-say', {
          detail: { text: `📝 Noted: "${o.title}"\n\n${o.why}\n\nConsider manually adding this to one of the narrative blocks above (Origin, Hook, Arc, Perspective, Pivots, Evidence, or Resolution).` }
        }))
      }, 100)
    }

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
