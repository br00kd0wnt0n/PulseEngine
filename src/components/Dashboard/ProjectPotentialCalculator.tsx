import { DragEvent, useMemo, useState, useEffect } from 'react'
import { useTrends } from '../../context/TrendContext'
import { useCreators } from '../../context/CreatorContext'
import { scoreConcept, potentialColor } from '../../services/scoring'
import { api } from '../../services/api'
import { useDashboard } from '../../context/DashboardContext'
import { logActivity } from '../../utils/activity'

export default function ProjectPotentialCalculator({ mode = 'full' }: { mode?: 'full' | 'viz' }) {
  const { snapshot } = useTrends()
  const { creators } = useCreators()
  const { concept: sharedConcept, setConcept: setSharedConcept, setKeyDrivers } = useDashboard()
  const [concept, setConcept] = useState(sharedConcept || 'AI music loop for dance challenge with retro gaming remix')
  useEffect(() => { if (sharedConcept) setConcept(sharedConcept) }, [sharedConcept])
  const [drag, setDrag] = useState(false)

  const localAnalysis = useMemo(() => scoreConcept(concept, snapshot(), creators), [concept, snapshot, creators])
  const [remote, setRemote] = useState<any | null>(null)
  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const r = await api.score(concept, snapshot())
        if (!cancel) { setRemote(r); try { logActivity('Story Breakdown calculated') } catch {} }
      } catch { setRemote(null) }
    })()
    return () => { cancel = true }
  }, [concept, snapshot])

  useEffect(() => {
    function refresh(e?: Event) {
      (async () => {
        try {
          const r = await api.score(concept, snapshot())
          setRemote(r)
          const reason = e?.type === 'conversation-updated' ? 'user input' : 'context'
          try { logActivity(`Story Breakdown recalculated based on ${reason}`) } catch {}
        } catch {}
      })()
    }
    window.addEventListener('context-updated', refresh as any)
    window.addEventListener('conversation-updated', refresh as any)
    return () => {
      window.removeEventListener('context-updated', refresh as any)
      window.removeEventListener('conversation-updated', refresh as any)
    }
  }, [concept, snapshot])
  const analysis = useMemo(() => {
    if (!remote) return localAnalysis
    const merged = {
      ...localAnalysis,
      scores: remote.scores || localAnalysis.scores,
      ralph: remote.ralph || (localAnalysis as any).ralph,
      keyDrivers: (localAnalysis as any).keyDrivers || remote.hits?.keywordHits || [],
      recommendedCreators: (localAnalysis as any).recommendedCreators || [],
    } as any
    return merged
  }, [remote, localAnalysis])

  // Expose key drivers to context for dedupe
  useEffect(() => {
    try { setKeyDrivers((analysis as any).keyDrivers || null) } catch {}
  }, [analysis, setKeyDrivers])

  const [prevScores, setPrevScores] = useState<{[k:string]: number}>({})
  useEffect(() => {
    setPrevScores(ps => ({
      audience: analysis.scores.audiencePotential,
      narrative: analysis.scores.narrativeStrength,
      collab: analysis.scores.collaborationOpportunity,
      ttp: analysis.scores.timeToPeakWeeks,
      adapt: (analysis as any).ralph?.narrativeAdaptability ?? ps.adapt,
      cross: (analysis as any).ralph?.crossPlatformPotential ?? ps.cross,
      culture: (analysis as any).ralph?.culturalRelevance ?? ps.culture,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis])

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setDrag(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    file.text().then(setConcept)
  }

  return (
    <div className="panel module p-4 transform-gpu h-[460px] overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Strategic Breakdown</div>
        {mode === 'viz' && (
          <button
            onClick={() => { window.dispatchEvent(new CustomEvent('open-chat')) }}
            className="text-xs px-2 py-1 rounded-full border border-white/10 bg-ralph-cyan/70 hover:bg-ralph-cyan"
          >+ Refine Story</button>
        )}
      </div>

      {mode === 'full' && null}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Score label="Audience Potential" value={analysis.scores.audiencePotential} prev={prevScores.audience} />
        <Score label="Narrative Strength" value={analysis.scores.narrativeStrength} prev={prevScores.narrative} />
        <Score label="Collaboration Opportunity" value={analysis.scores.collaborationOpportunity} prev={prevScores.collab} />
        <div className="panel p-3">
          <div className="text-white/60 text-xs">Time to Peak</div>
          <div className="text-lg font-semibold flex items-center gap-2">
            {analysis.scores.timeToPeakWeeks} weeks
            <DeltaBadge delta={delta(analysis.scores.timeToPeakWeeks, prevScores.ttp)} />
          </div>
        </div>
      </div>

      {analysis.ralph && (
        <div className="mt-4 panel p-3">
          <div className="text-xs text-white/60 mb-2">Ralph Scoring</div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Score label="Adaptability" value={analysis.ralph.narrativeAdaptability} prev={prevScores.adapt} />
            <Score label="Cross-Platform" value={analysis.ralph.crossPlatformPotential} prev={prevScores.cross} />
            <Score label="Cultural Relevance" value={analysis.ralph.culturalRelevance} prev={prevScores.culture} />
          </div>
        </div>
      )}

      <div className="mt-4 grid md:grid-cols-2 gap-3">
        <div className="panel p-3">
          <div className="text-xs text-white/60 mb-2">Key Drivers</div>
          <div className="flex flex-wrap gap-2">
            {(analysis.keyDrivers || []).map((k: string) => <span key={k} className="px-2 py-1 rounded border border-white/10 text-xs bg-charcoal-700/40">{k}</span>)}
          </div>
        </div>
        {/* Recommended collaborators removed; covered by Creator Intelligence */}
      </div>
    </div>
  )
}

function delta(curr?: number, prev?: number) { if (typeof curr !== 'number' || typeof prev !== 'number') return 0; return Math.round(curr - prev) }

function DeltaBadge({ delta }: { delta?: number }) {
  if (delta === undefined || delta === 0) return null
  const pos = delta > 0
  const txt = (pos ? '+' : '') + delta
  const cls = pos ? 'border-ralph-pink/40 bg-ralph-pink/10 text-ralph-pink' : 'border-ralph-cyan/40 bg-ralph-cyan/10 text-ralph-cyan'
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${cls}`}>{txt}</span>
}

function Score({ label, value, prev }: { label: string; value: number; prev?: number }) {
  const color = potentialColor(value)
  return (
    <div className="panel p-3">
      <div className="text-white/60 text-xs flex items-center gap-2">{label} <DeltaBadge delta={delta(value, prev)} /></div>
      <div className="flex items-center gap-3 mt-1">
        <div className="text-lg font-semibold w-12">{Math.round(value)}</div>
        <div className="flex-1 h-2 rounded bg-charcoal-700/50">
          <div className="h-2 rounded" style={{ width: `${value}%`, background: color }} />
        </div>
      </div>
    </div>
  )
}
