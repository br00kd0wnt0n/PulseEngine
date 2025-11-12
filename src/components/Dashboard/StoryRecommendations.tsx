import { useEffect, useState } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { api } from '../../services/api'
import { useTrends } from '../../context/TrendContext'

const categories = [
  { key: 'narrative', title: 'Narrative Development' },
  { key: 'content', title: 'Content Strategy' },
  { key: 'platform', title: 'Platform Coverage' },
  { key: 'collab', title: 'Collaboration' },
]

export default function StoryRecommendations() {
  const { concept } = useDashboard()
  const { snapshot } = useTrends()
  const [recs, setRecs] = useState<Record<string, string[]>>({ narrative: [], content: [], platform: [], collab: [] })

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

  return (
    <div className="panel module p-4">
      <div className="font-semibold mb-3">Story Recommendations</div>
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
      <FrameworkViz />
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

function FrameworkViz() {
  // Simple radar placeholder with 5 axes
  const axes = ['Hook','Clarity','Arc','Emotion','Adaptability']
  const values = [70, 60, 65, 55, 75]
  const cx = 120, cy = 120, r = 80
  const points = values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2
    const rr = (v / 100) * r
    return [cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr]
  })
  const path = points.map(p => p.join(',')).join(' ')
  return (
    <div className="mt-4 panel p-3">
      <div className="text-xs text-white/60 mb-2">Storytelling Framework (placeholder)</div>
      <svg width={240} height={240} className="block mx-auto">
        {/* grid */}
        {[20,40,60,80].map((rr, idx) => (
          <circle key={idx} cx={cx} cy={cy} r={(rr/100)*r} fill="none" stroke="rgba(255,255,255,0.1)" />
        ))}
        {axes.map((_, i) => {
          const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2
          const x = cx + Math.cos(angle) * r
          const y = cy + Math.sin(angle) * r
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.1)" />
        })}
        {/* polygon */}
        <polygon points={path} fill="rgba(59,232,255,0.25)" stroke="#3be8ff" />
        {/* axis labels */}
        {axes.map((a, i) => {
          const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2
          const x = cx + Math.cos(angle) * (r + 14)
          const y = cy + Math.sin(angle) * (r + 14)
          return <text key={i} x={x} y={y} fill="#9aa" fontSize={10} textAnchor="middle" dominantBaseline="middle">{a}</text>
        })}
      </svg>
    </div>
  )
}
