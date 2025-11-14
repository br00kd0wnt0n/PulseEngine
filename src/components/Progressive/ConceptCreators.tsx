import { useEffect, useMemo, useState } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { useCreators } from '../../context/CreatorContext'

type Block = { id: string; key: string; title: string; content: string }

export default function ConceptCreators() {
  const { concept } = useDashboard()
  const { recommended } = useCreators()
  const [blocks, setBlocks] = useState<Block[]>([])

  const projectId = useMemo(() => { try { return localStorage.getItem('activeProjectId') || 'local' } catch { return 'local' } }, [])
  const storageKey = `nf:${projectId}`

  useEffect(() => {
    try { const raw = localStorage.getItem(storageKey); if (raw) setBlocks(JSON.parse(raw)) } catch {}
  }, [storageKey, concept])

  const refined = useMemo(() => synthesizeRefined(concept, blocks), [concept, blocks])
  const top = (recommended || []).slice(0, 3)

  return (
    <div className="panel module p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">CONCEPT + CREATORS</div>
        <div className="text-xs text-white/60">Shareable brief draft</div>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="text-white/90 font-medium">{refined.oneLiner}</div>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
            {refined.bullets.map((b, i) => <li key={i} className="text-white/80">{b}</li>)}
          </ul>
        </div>
        <div>
          <div className="text-xs text-white/60 mb-1">Top Creators</div>
          <div className="space-y-2">
            {top.map((c) => (
              <div key={c.id} className="panel p-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[10px] text-white/60">{c.platform}</div>
                </div>
                <div className="text-[11px] text-white/60">{c.category}</div>
                <div className="text-[11px] text-white/50 mt-1">Why: {explainWhy(c.tags)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function synthesizeRefined(concept: string, blocks: Block[]) {
  const byKey = (k: string) => blocks.find(b => b.key === k)?.content?.trim() || ''
  const hook = byKey('hook')
  const premise = byKey('origin') || concept
  const pivot = byKey('pivots')
  const evidence = byKey('evidence')
  const resolution = byKey('resolution')
  const oneLiner = hook || `Premise: ${premise}`
  const bullets = [pivot, evidence, resolution].filter(Boolean).slice(0,3)
  return { oneLiner, bullets }
}

function explainWhy(tags: string[]) {
  const top = (tags || []).slice(0,2).join(' / ')
  return top || 'Strong creative fit'
}

