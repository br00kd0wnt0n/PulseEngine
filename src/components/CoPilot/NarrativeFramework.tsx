import { useEffect, useMemo, useRef, useState } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { logActivity } from '../../utils/activity'

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
  const [blocks, setBlocks] = useState<Block[]>([])
  const [dragId, setDragId] = useState<string | null>(null)

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

  function applySuggestion(idx: number, text: string) {
    setBlocks(bs => bs.map((b, i) => i === idx ? { ...b, content: text } : b))
    try { window.dispatchEvent(new CustomEvent('activity-log', { detail: { ts: Date.now(), msg: `Applied suggestion to ${blocks[idx].title}` } })) } catch {}
  }

  function insertIntoChat(text: string) {
    try { window.dispatchEvent(new CustomEvent('copilot-insert', { detail: { text } })) } catch {}
  }

  return (
    <div className="panel module p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Narrative Deconstruction</div>
        <div className="text-xs text-white/60">Coherence: <span className="font-semibold text-white/80">{coherence}</span></div>
      </div>
      <div className="relative overflow-x-auto">
        <div className="flex items-stretch gap-3 min-w-full">
          {blocks.map((b, idx) => (
            <div
              key={b.id}
              className="relative panel p-3 w-[260px] shrink-0"
              draggable
              onDragStart={() => setDragId(b.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropReorder(b.id)}
            >
              <div className="text-xs text-white/60 mb-1 flex items-center justify-between">
                <span>{b.title}</span>
                <button className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => insertIntoChat(`${b.title}: ${b.content || suggestFromDrivers(b, keyDrivers, concept)}`)}>Insert</button>
              </div>
              <textarea
                className="w-full h-24 bg-charcoal-800/70 border border-white/10 rounded p-2 text-xs"
                placeholder={b.hints.join(' • ')}
                value={b.content}
                onChange={(e) => setBlocks(bs => bs.map((x, i) => i === idx ? { ...x, content: e.target.value } : x))}
              />
              {/* Suggestions */}
              <div className="mt-2 flex flex-wrap gap-1">
                {buildSuggestions(b, keyDrivers, concept).map((s, i) => (
                  <button key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => applySuggestion(idx, s)}>{s}</button>
                ))}
              </div>
              {/* Connector line */}
              {idx < blocks.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-white/10" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function buildSuggestions(b: Omit<Block, 'id'>, keyDrivers?: string[] | null, concept?: string): string[] {
  const kd = (keyDrivers || []).slice(0, 2)
  const base: Record<string, string[]> = {
    origin: kd.length ? kd.map(k => `Premise centers on ${k}`) : ['Define the core promise'],
    hook: kd.length ? kd.map(k => `Open with ${k} in frame 1`) : ['Condense hook to 7–10 words'],
    arc: ['Three-beat arc: setup • turn • payoff'],
    perspective: ['Add stakeholder POV in beat 2'],
    pivots: ['Define the moment that shifts momentum'],
    evidence: ['Add a proof element (stat/case)'],
    resolution: ['Close with explicit payoff + CTA'],
  }
  return (base[b.key] || []).slice(0, 3)
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

