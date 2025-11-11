import { DragEvent, useMemo, useState, useEffect } from 'react'
import { useTrends } from '../../context/TrendContext'
import { useCreators } from '../../context/CreatorContext'
import { scoreConcept, potentialColor } from '../../services/scoring'
import { api } from '../../services/api'
import { useDashboard } from '../../context/DashboardContext'

export default function ProjectPotentialCalculator() {
  const { snapshot } = useTrends()
  const { creators } = useCreators()
  const { concept: sharedConcept, setConcept: setSharedConcept } = useDashboard()
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
        if (!cancel) setRemote(r)
      } catch { setRemote(null) }
    })()
    return () => { cancel = true }
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

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setDrag(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    file.text().then(setConcept)
  }

  return (
    <div className="panel module p-4 transform-gpu">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Project Potential Calculator</div>
        <div className="text-xs text-white/50">Drop a text brief</div>
      </div>

      <div
        onDragEnter={() => setDrag(true)} onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)} onDrop={onDrop}
        className={`rounded-md border ${drag ? 'border-ralph-pink bg-charcoal-700/30' : 'border-white/10 bg-charcoal-800/50'} p-3 mb-3`}
      >
        <textarea
          className="w-full bg-transparent outline-none text-sm min-h-[80px]"
          value={concept}
          onChange={(e) => { setConcept(e.target.value); setSharedConcept(e.target.value) }}
          placeholder="Describe your concept..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Score label="Audience Potential" value={analysis.scores.audiencePotential} />
        <Score label="Narrative Strength" value={analysis.scores.narrativeStrength} />
        <Score label="Collaboration Opportunity" value={analysis.scores.collaborationOpportunity} />
        <div className="panel p-3">
          <div className="text-white/60 text-xs">Time to Peak</div>
          <div className="text-lg font-semibold">{analysis.scores.timeToPeakWeeks} weeks</div>
        </div>
      </div>

      {analysis.ralph && (
        <div className="mt-4 panel p-3">
          <div className="text-xs text-white/60 mb-2">Ralph Scoring</div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Score label="Adaptability" value={analysis.ralph.narrativeAdaptability} />
            <Score label="Cross-Platform" value={analysis.ralph.crossPlatformPotential} />
            <Score label="Cultural Relevance" value={analysis.ralph.culturalRelevance} />
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
        <div className="panel p-3">
          <div className="text-xs text-white/60 mb-2">Recommended Collaborators</div>
          <div className="flex flex-wrap gap-2">
            {(analysis.recommendedCreators || []).map((c: any) => (
              <span key={c.id} className="px-2 py-1 rounded border border-white/10 text-xs bg-ralph-purple/20">{c.name}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Score({ label, value }: { label: string; value: number }) {
  const color = potentialColor(value)
  return (
    <div className="panel p-3">
      <div className="text-white/60 text-xs">{label}</div>
      <div className="flex items-center gap-3 mt-1">
        <div className="text-lg font-semibold w-12">{Math.round(value)}</div>
        <div className="flex-1 h-2 rounded bg-charcoal-700/50">
          <div className="h-2 rounded" style={{ width: `${value}%`, background: color }} />
        </div>
      </div>
    </div>
  )
}
