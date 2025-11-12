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
        // Use narrative to steer simple recommendations (MVP: heuristic)
        const n = await api.narrative(snapshot(), null).catch(() => ({ text: '' }))
        const text = typeof n === 'object' ? (n as any).text || '' : ''
        if (cancel) return
        const base = buildHeuristicRecs(concept, text)
        setRecs(base)
      } catch {
        setRecs(buildHeuristicRecs(concept, ''))
      }
    })()
    return () => { cancel = true }
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

