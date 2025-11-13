import { useEffect, useMemo, useRef, useState } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { useTrends } from '../../context/TrendContext'
import { api } from '../../services/api'
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
  const { snapshot } = useTrends() as any
  const [blocks, setBlocks] = useState<Block[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

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
      try {
        const recs = await api.recommendations(concept, snapshot())
        if (cancel || !recs) return
        setBlocks(bs => bs.map((b) => {
          if (touched[b.id]) return b
          const filled = autofillBlock(b, concept, keyDrivers as string[] | undefined, recs)
          return { ...b, content: filled }
        }))
        try { logActivity('Narrative deconstruction auto‑filled from AI') } catch {}
      } catch {}
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
                onChange={(e) => onEdit(idx, e.target.value)}
              />
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

function autofillBlock(b: Omit<Block, 'id'>, concept?: string, keyDrivers?: string[], recs?: any): string {
  const kd = keyDrivers || []
  const first = (arr?: string[]) => (Array.isArray(arr) && arr[0]) || ''
  const join2 = (arr?: string[]) => (Array.isArray(arr) ? arr.slice(0,2).join(' • ') : '')
  switch (b.key) {
    case 'origin': return concept ? `Premise: ${concept}` : ''
    case 'hook': return first(recs?.narrative) || suggestFromDrivers(b, kd, concept)
    case 'arc': return `Arc: ${join2(recs?.narrative)}`
    case 'perspective': return kd.length ? `Perspectives: ${kd.slice(0,2).join(', ')}` : 'Perspectives: audience • creator'
    case 'pivots': return first(recs?.content) ? `Pivot: ${first(recs?.content)}` : ''
    case 'evidence': return first(recs?.platform) ? `Evidence: ${first(recs?.platform)}` : ''
    case 'resolution': return first(recs?.collab) ? `Outcome: ${first(recs?.collab)}` : 'Outcome: clear payoff + CTA'
    default: return ''
  }
}
