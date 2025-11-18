import { useEffect, useMemo, useRef, useState } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { useTrends } from '../../context/TrendContext'
import { api } from '../../services/api'
import { logActivity } from '../../utils/activity'
import LoadingSpinner from '../Common/LoadingSpinner'

type Block = {
  id: string
  key: string
  title: string
  hints: string[]
  content: string
}

const DEFAULT_BLOCKS: Omit<Block, 'id' | 'content'>[] = [
  { key: 'origin', title: 'Origin / Premise', hints: ['Core concept', 'Initial spark', 'Foundational idea'] },
  { key: 'hook', title: 'Hook', hints: ['Compelling entry point', 'Engagement trigger', 'Emotional resonance'] },
  { key: 'arc', title: 'Narrative Arc', hints: ['Story progression', 'Development stages', 'Thematic trajectory'] },
  { key: 'perspective', title: 'Perspective Shifts', hints: ['Viewpoint layers', 'Stakeholder insights', 'Complexity'] },
  { key: 'pivots', title: 'Pivotal Moments', hints: ['Decision points', 'Transformations', 'Momentum changes'] },
  { key: 'evidence', title: 'Supporting Evidence', hints: ['Substantiating elements', 'Credibility markers', 'Reinforcement'] },
  { key: 'resolution', title: 'Resolution / Outcome', hints: ['Conclusion', 'Payoff', 'Implications'] },
]

export default function NarrativeFramework() {
  const { concept, keyDrivers } = useDashboard() as any
  const { snapshot } = useTrends() as any
  const [blocks, setBlocks] = useState<Block[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)

  const projectId = useMemo(() => { try { return localStorage.getItem('activeProjectId') || 'local' } catch { return 'local' } }, [])
  const storageKey = `nf:${projectId}`

  // Load/save
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) { setBlocks(JSON.parse(raw)); return }
    } catch {}
    const init = DEFAULT_BLOCKS.map((b, i) => ({ id: `${b.key}-${i}`, content: '', ...b }))
    setBlocks(init)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(blocks)) } catch {}
  }, [blocks, storageKey])

  // Coherence scoring (simple heuristic)
  const coherence = useMemo(() => {
    const filled = blocks.filter(b => b.content.trim().length > 0)
    const fillScore = Math.min(100, Math.round((filled.length / blocks.length) * 70))
    const kd = (keyDrivers || []) as string[]
    const kdHits = filled.reduce((acc, b) => acc + countIntersections(b.content, kd), 0)
    const kdScore = Math.min(30, kdHits * 6)
    return fillScore + kdScore
  }, [blocks, keyDrivers])

  function onDropReorder(targetId: string) {
    if (!dragId || dragId === targetId) return
    const srcIdx = blocks.findIndex(b => b.id === dragId)
    const tgtIdx = blocks.findIndex(b => b.id === targetId)
    if (srcIdx < 0 || tgtIdx < 0) return
    const copy = blocks.slice()
    const [moved] = copy.splice(srcIdx, 1)
    copy.splice(tgtIdx, 0, moved)
    setBlocks(copy)
    try { logActivity(`Narrative block moved: ${moved.title}`) } catch {}
  }

  function insertIntoChat(text: string) {
    try { window.dispatchEvent(new CustomEvent('copilot-insert', { detail: { text } })) } catch {}
  }

  // Listen for external apply to a target block
  useEffect(() => {
    function onApply(e: any) {
      const { target, text } = e?.detail || {}
      if (!target || !text) return
      const idx = blocks.findIndex(b => b.key === target)
      if (idx < 0) return
      setBlocks(bs => bs.map((x, i) => i === idx ? { ...x, content: text } : x))
      setTouched(t => ({ ...t, [blocks[idx]?.id || target]: true }))
      try { logActivity(`Applied to ${target}: ${text}`) } catch {}
    }
    window.addEventListener('nf-apply' as any, onApply as any)
    return () => window.removeEventListener('nf-apply' as any, onApply as any)
  }, [blocks])

  // Mark touched when user edits
  function onEdit(idx: number, value: string) {
    const b = blocks[idx]
    setBlocks(bs => bs.map((x, i) => i === idx ? { ...x, content: value } : x))
    setTouched(t => ({ ...t, [b.id]: true }))
  }

  // Autofill via AI recommendations; refresh on concept/context/conversation
  useEffect(() => {
    let cancel = false
    async function run() {
      if (!concept) return
      setLoading(true)
      try {
        const region = (localStorage.getItem('region') || '').replace(/"/g,'')
        const persona = (localStorage.getItem('persona') || '').replace(/"/g,'')
        const pid = localStorage.getItem('activeProjectId') || 'local'
        const [recs, deb, opp] = await Promise.all([
          api.recommendations(concept, snapshot(), { persona, region, projectId: pid }),
          api.debrief(concept, { persona, region, projectId: pid }).catch(()=>null),
          api.opportunities(concept, { persona, region, projectId: pid }).catch(()=>null)
        ])
        if (cancel || !recs) return
        setBlocks(bs => bs.map((b) => {
          if (touched[b.id]) return b
          const filled = autofillBlock(b, concept, keyDrivers as string[] | undefined, recs, deb, opp)
          return { ...b, content: filled }
        }))
        try { logActivity('Narrative deconstruction auto‑filled from AI') } catch {}
      } catch {}
      finally { if (!cancel) setLoading(false) }
    }
    run()
    function refresh() { run() }
    window.addEventListener('context-updated', refresh)
    window.addEventListener('conversation-updated', refresh)
    return () => {
      cancel = true
      window.removeEventListener('context-updated', refresh)
      window.removeEventListener('conversation-updated', refresh)
    }
  }, [concept, snapshot, keyDrivers, touched])

  return (
    <div className="panel module p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Narrative Deconstruction</div>
        <div className="text-xs text-white/60">Coherence: <span className="font-semibold text-white/80">{coherence}</span></div>
      </div>
      {loading && <LoadingSpinner text="Deconstructing narrative structure from AI analysis…" />}
      {!loading && (
      <div className="relative overflow-x-auto">
        <div className="flex items-stretch gap-3 min-w-full">
          {blocks.map((b, idx) => (
            <div
              key={b.id}
              className="relative panel p-3 w-[260px] shrink-0"
            >
              <div className="text-xs text-white/60 mb-1 flex items-center justify-between">
                <span>{b.title}</span>
                {!editing[b.id] && (
                  <button className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setEditing(ed => ({ ...ed, [b.id]: true }))}>Edit</button>
                )}
                {editing[b.id] && (
                  <button
                    className="text-[10px] px-1.5 py-0.5 rounded border border-ralph-teal/40 bg-ralph-teal/10 hover:bg-ralph-teal/20"
                    onClick={() => {
                      setEditing(ed => ({ ...ed, [b.id]: false }))
                      setTouched(t => ({ ...t, [b.id]: true }))
                      try { window.dispatchEvent(new CustomEvent('conversation-updated')) } catch {}
                      try { logActivity(`Saved ${b.title}; reassessing narrative`) } catch {}
                    }}
                  >Save</button>
                )}
              </div>
              {!editing[b.id] && (
                <div className="w-full min-h-[96px] bg-charcoal-800/50 border border-white/10 rounded p-2 text-xs text-white/80 whitespace-pre-wrap">
                  {b.content || b.hints.join(' • ')}
                </div>
              )}
              {editing[b.id] && (
                <textarea
                  className="w-full h-24 bg-charcoal-800/70 border border-white/10 rounded p-2 text-xs"
                  placeholder={b.hints.join(' • ')}
                  value={b.content}
                  onChange={(e) => onEdit(idx, e.target.value)}
                />
              )}
              {/* Connector line */}
              {idx < blocks.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-white/10" />
              )}
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  )
}

function suggestFromDrivers(b: Omit<Block, 'id'>, keyDrivers?: string[] | null, concept?: string) {
  const kd = (keyDrivers || [])
  if (b.key === 'hook' && kd[0]) return `Open with ${kd[0]} and a 7–10 word promise`
  if (b.key === 'origin' && concept) return `Premise: ${concept}`
  return ''
}

function countIntersections(text: string, drivers: string[]) {
  if (!Array.isArray(drivers) || drivers.length === 0) return 0
  const words = text.toLowerCase()
  return drivers.reduce((acc, d) => acc + (words.includes(String(d).toLowerCase()) ? 1 : 0), 0)
}

function autofillBlock(b: Omit<Block, 'id'>, concept?: string, keyDrivers?: string[], recs?: any, deb?: any, opp?: any): string {
  const kd = keyDrivers || []
  const first = (arr?: string[]) => (Array.isArray(arr) && arr[0]) || ''

  switch (b.key) {
    case 'origin': {
      // Campaign premise/setup - start with the concept, optionally enhanced by strategic insight
      if (concept && deb?.brief) {
        // Extract first sentence of brief for context
        const briefFirstSentence = deb.brief.split('.')[0]
        return `${concept} - ${briefFirstSentence}`
      }
      return concept || 'Define the campaign premise and core story setup'
    }

    case 'hook': {
      // Opening hook - use narrative recommendations or debrief strategic points
      const narrativeHook = first(recs?.narrative)
      if (narrativeHook) return narrativeHook

      // Look for hook-related opportunities
      const hookOpp = opp?.opportunities?.find((x: any) => /hook|open|grab|attract/i.test(x.title))
      if (hookOpp) return hookOpp.title

      // Use first debrief key point as hook
      if (deb?.keyPoints?.[0]) return `Hook: ${deb.keyPoints[0]}`

      // Use key drivers for concept-specific hook
      if (kd[0] && concept) return `Open with ${kd[0]}-driven hook that introduces "${concept}" in first 3-5 seconds`

      // Ultimate fallback: concept-specific generic
      return concept ? `Lead with visual hook that immediately showcases the value of "${concept}"` : 'Define campaign opening hook that grabs attention'
    }

    case 'arc': {
      // Full campaign narrative arc - combine multiple strategic elements
      const narrativeElements = recs?.narrative || []
      if (narrativeElements.length >= 2) {
        return `Campaign unfolds through: ${narrativeElements.slice(0, 3).join(' → ')}`
      }

      // Fallback: use debrief key points as arc beats
      if (deb?.keyPoints && deb.keyPoints.length >= 2) {
        return `Story progression: Setup → ${deb.keyPoints[0]} → ${deb.keyPoints[1]}`
      }

      return concept ? `Build narrative arc for "${concept}" from introduction through climax to resolution` : 'Define campaign story arc'
    }

    case 'perspective': {
      // How the story is framed/told (POV, framing, narrative voice)
      const contentRecs = recs?.content || []
      const perspectiveRec = contentRecs.find((r: string) => /perspective|pov|voice|frame|tell|story/i.test(r))
      if (perspectiveRec) return perspectiveRec

      // Use key drivers to suggest perspectives
      if (kd.length >= 2) {
        return `Tell the story from ${kd[0]} perspective, shifting to ${kd[1]} viewpoint for emotional impact`
      }

      return 'First-person POV from campaign protagonist, shifting to audience perspective in final act'
    }

    case 'pivots': {
      // Key turning points in the campaign story
      const pivotOpp = opp?.opportunities?.find((x: any) => /pivot|moment|turn|beat|shift/i.test(x.title))
      if (pivotOpp) return pivotOpp.title

      const contentPivot = recs?.content?.find((r: string) => /pivot|turn|shift|moment/i.test(r))
      if (contentPivot) return contentPivot

      // Use second debrief point as potential pivot
      if (deb?.keyPoints?.[1]) return `Pivotal moment: ${deb.keyPoints[1]}`

      // Use any debrief point as pivot context
      if (deb?.keyPoints?.[0]) return `Turn the story when ${deb.keyPoints[0]} is revealed or challenged`

      // Concept-specific pivot suggestion
      if (concept) return `Create turning point where "${concept}" shifts from introduction to transformation or payoff`

      return 'Define the pivotal moment where campaign narrative shifts (challenge revealed, solution discovered, transformation happens)'
    }

    case 'evidence': {
      // Campaign supporting evidence - NOT stats, but campaign proof assets
      const platformRecs = recs?.platform || []

      // Look for content/evidence-related opportunities
      const evidenceOpp = opp?.opportunities?.find((x: any) => /proof|evidence|show|demonstrate|visual/i.test(x.title))
      if (evidenceOpp) return evidenceOpp.title

      // Suggest platform-specific evidence types
      if (platformRecs.length > 0) {
        return `Capture supporting evidence through: ${platformRecs.slice(0, 2).join(', ')}`
      }

      return 'Include B-roll footage, user testimonials, before/after comparisons, or data visualizations that prove the campaign value'
    }

    case 'resolution': {
      // Campaign wrap-up with CTA and payoff
      const collabRecs = recs?.collab || []
      const resolutionOpp = opp?.opportunities?.find((x: any) => /cta|outcome|payoff|resolution|conclude/i.test(x.title))

      if (resolutionOpp) return resolutionOpp.title

      if (collabRecs.length > 0) {
        return `Conclude with ${first(collabRecs)} and clear call-to-action`
      }

      // Use last debrief point as resolution context
      const lastPoint = deb?.keyPoints?.[deb.keyPoints.length - 1]
      if (lastPoint) return `Wrap campaign with ${lastPoint}, delivering clear payoff and next-step CTA`

      return 'End with emotional payoff, clear takeaway message, and strong call-to-action (follow, share, participate, purchase)'
    }

    default: return ''
  }
}
