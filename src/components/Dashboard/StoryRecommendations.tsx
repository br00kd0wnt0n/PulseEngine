import { useEffect, useMemo, useState } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { api } from '../../services/api'
import { useTrends } from '../../context/TrendContext'
import Tooltip from '../shared/Tooltip'

const categories = [
  { key: 'narrative', title: 'Narrative Development' },
  { key: 'content', title: 'Content Strategy' },
  { key: 'platform', title: 'Platform Coverage' },
  { key: 'collab', title: 'Collaboration' },
]

type Framework = { market: { score: number; why: string }; narrative: { score: number; why: string }; commercial: { score: number; why: string } }
type RecResponse = { narrative: string[]; content: string[]; platform: string[]; collab: string[]; framework?: Framework }

export default function StoryRecommendations() {
  const { concept, setFrameworkScores } = useDashboard()
  const { snapshot } = useTrends()
  const [recs, setRecs] = useState<RecResponse>({ narrative: [], content: [], platform: [], collab: [] })

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const r = await api.recommendations(concept || '', snapshot())
        if (!cancel && r && typeof r === 'object') setRecs(r)
      } catch {
        // fallback heuristic
        setRecs(buildHeuristicRecs(concept, ''))
      }
    })()
    return () => { cancel = true }
  }, [concept, snapshot])

  // Refresh on context or conversation updates
  useEffect(() => {
    function refresh() {
      (async () => {
        try { const r = await api.recommendations(concept || '', snapshot()); if (r) setRecs(r) } catch {}
      })()
    }
    window.addEventListener('context-updated', refresh)
    window.addEventListener('conversation-updated', refresh)
    return () => {
      window.removeEventListener('context-updated', refresh)
      window.removeEventListener('conversation-updated', refresh)
    }
  }, [concept, snapshot])

  // Update global framework scores for Save Version snapshots
  useEffect(() => {
    const f = (recs as any)?.framework as Framework | undefined
    if (f && typeof f.market?.score === 'number' && typeof f.narrative?.score === 'number' && typeof f.commercial?.score === 'number') {
      setFrameworkScores({ market: f.market.score, narrative: f.narrative.score, commercial: f.commercial.score })
    } else {
      // Fallback from density mapping
      const [m, n, c] = deriveFrameworkFromRecs(recs)
      setFrameworkScores({ market: m, narrative: n, commercial: c })
    }
  }, [recs, setFrameworkScores])

  return (
    <div className="panel module p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Story Recommendations</div>
        <div className="text-xs text-white/60 flex items-center">
          How this works
          <Tooltip label="How this works"><span>Scores reflect density and type of recommendations; AI rationale summarizes why a dimension is strong or weak.</span></Tooltip>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        {categories.map(c => (
          <div key={c.key} className="panel p-3">
            <div className="text-xs text-white/60 mb-2">{c.title}</div>
            <ul className="list-disc pl-4 space-y-1">
              {(recs[c.key] || []).map((r, i) => <li key={i} className="text-white/80">{r}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <FrameworkViz recs={recs} />
    </div>
  )
}

function buildHeuristicRecs(concept?: string, narrative?: string) {
  const lc = (concept || '').toLowerCase()
  const trends = {
    dance: lc.includes('dance') || (narrative || '').toLowerCase().includes('dance'),
    ai: lc.includes('ai') || (narrative || '').toLowerCase().includes('ai'),
    retro: lc.includes('retro') || (narrative || '').toLowerCase().includes('retro'),
    tutorial: lc.includes('tutorial') || (narrative || '').toLowerCase().includes('tutorial'),
  }
  const narrativeRecs = [
    trends.ai ? 'Lean into AI hooks; keep language direct and benefit-led.' : 'Clarify the core hook in the first sentence.',
    trends.retro ? 'Add a nostalgia beat; call it out explicitly.' : 'Add a cultural beat that resonates with target audience.',
  ]
  const contentRecs = [
    trends.tutorial ? 'Create a 20–30s how-to variant to boost saves.' : 'Plan a tutorial cut to improve saves and replays.',
    trends.dance ? 'Design a loop-friendly beat for the dance moment (7–10s).' : 'Consider a loopable segment to support replays.',
  ]
  const platformRecs = [
    'Publish trims for TikTok, Shorts, and Reels; adjust opening 2s per platform.',
    trends.retro ? 'Use caption overlays to tie nostalgia to modern format.' : 'Use captions to highlight the hook in frame 1.',
  ]
  const collabRecs = [
    trends.dance ? 'Target dance creators with duet prompts and a clear beat.' : 'Invite creator duets with a simple prompt and stitch cue.',
    'Line up one macro + three micro collabs for coverage.',
  ]
  return { narrative: narrativeRecs, content: contentRecs, platform: platformRecs, collab: collabRecs }
}

function deriveFrameworkFromRecs(recs: RecResponse): [number, number, number] {
  // Fallback mapping when framework object missing: density → scores (0–100)
  const n = (recs.narrative || []).length
  const c = (recs.content || []).length
  const p = (recs.platform || []).length
  const k = (recs.collab || []).length
  const market = Math.min(100, 45 + (p + k) * 10)
  const narrative = Math.min(100, 50 + n * 12 + c * 4)
  const commercial = Math.min(100, 40 + k * 12 + p * 6)
  return [market, narrative, commercial]
}

function FrameworkViz({ recs }: { recs: RecResponse }) {
  // 3-axis radar: Market Resonance, Narrative Potential, Commercial Viability
  const framework = (recs as any)?.framework as Framework | undefined
  const values = framework
    ? [framework.market.score || 0, framework.narrative.score || 0, framework.commercial.score || 0]
    : deriveFrameworkFromRecs(recs)
  const whys = framework ? [framework.market.why, framework.narrative.why, framework.commercial.why] : [
    'Mapped from platform + collab density.',
    'Mapped from narrative + content density.',
    'Mapped from collab + platform density.',
  ]
  const axes = ['Market Resonance','Narrative Potential','Commercial Viability']
  const cx = 120, cy = 120, r = 80
  const points = values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2
    const rr = (v / 100) * r
    return [cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr]
  })
  const path = points.map(p => p.join(',')).join(' ')
  return (
    <div className="mt-4 panel p-3">
      <div className="text-xs text-white/60 mb-2">Storytelling Framework</div>
      <svg width={240} height={240} className="block mx-auto">
        {[20,40,60,80].map((rr, idx) => (
          <circle key={idx} cx={cx} cy={cy} r={(rr/100)*r} fill="none" stroke="rgba(255,255,255,0.1)" />
        ))}
        {axes.map((_, i) => {
          const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2
          const x = cx + Math.cos(angle) * r
          const y = cy + Math.sin(angle) * r
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.1)" />
        })}
        <polygon points={path} fill="rgba(59,232,255,0.25)" stroke="#3be8ff" />
        {axes.map((a, i) => {
          const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2
          const x = cx + Math.cos(angle) * (r + 18)
          const y = cy + Math.sin(angle) * (r + 18)
          return (
            <g key={i} transform={`translate(${x},${y})`}>
              <foreignObject x={-60} y={-10} width={120} height={20}>
                <div className="flex items-center justify-center gap-1 text-[10px] text-[#9aa]">
                  <span>{a}</span>
                  <Tooltip label={a}><span>{whys[i]}</span></Tooltip>
                </div>
              </foreignObject>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
