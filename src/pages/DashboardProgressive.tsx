import { useEffect, useMemo, useState } from 'react'
import StoryPromptHero from '../components/Dashboard/StoryPromptHero'
import AtAGlanceV2 from '../components/Dashboard/AtAGlanceV2'
import NarrativeFramework from '../components/CoPilot/NarrativeFramework'
import CoPilotChat from '../components/CoPilot/CoPilotChat'
import NarrativeOverview from '../components/Dashboard/NarrativeOverview'
import CreatorPanel from '../components/Dashboard/CreatorPanel'
import StoryRecommendations from '../components/Dashboard/StoryRecommendations'
import ScoringEnhancements from '../components/Progressive/ScoringEnhancements'
import ActivityPanel from '../components/CoPilot/ActivityPanel'
import DebriefOpportunities from '../components/Progressive/DebriefOpportunities'
import ConceptCreators from '../components/Progressive/ConceptCreators'
import { useDashboard } from '../context/DashboardContext'
import { usePreferences } from '../context/PreferencesContext'
import { useUpload } from '../context/UploadContext'

type Stage = 'initial' | 'foundation' | 'depth' | 'full'

export default function DashboardProgressive() {
  const { concept, activated } = useDashboard()
  const prefs = usePreferences()
  const { processed } = useUpload()
  const [stage, setStage] = useState<Stage>('initial')

  const projectId = useMemo(() => { try { return localStorage.getItem('activeProjectId') || 'local' } catch { return 'local' } }, [])
  const storageKey = `progressive:stage:${projectId}`

  // Load/save stage
  useEffect(() => {
    try { const s = localStorage.getItem(storageKey) as Stage | null; if (s) setStage(s) } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])
  useEffect(() => { try { localStorage.setItem(storageKey, stage) } catch {} }, [stage, storageKey])

  // Advance to foundation after initial submit
  useEffect(() => { if (activated && stage === 'initial') setStage('foundation') }, [activated, stage])

  // Advance heuristics on conversation/context events
  useEffect(() => {
    function advance() {
      const convKey = `conv:${projectId}`
      let convCount = 0
      try { convCount = (JSON.parse(localStorage.getItem(convKey) || '[]') as any[]).length } catch {}
      if (stage === 'foundation' && convCount >= 1) setStage('depth')
      if (stage === 'depth' && convCount >= 3) setStage('full')
    }
    window.addEventListener('conversation-updated', advance as any)
    window.addEventListener('context-updated', advance as any)
    return () => { window.removeEventListener('conversation-updated', advance as any); window.removeEventListener('context-updated', advance as any) }
  }, [stage, projectId])

  const tags = Array.from(new Set(processed.flatMap(p => p.tags))).slice(0, 16)

  return (
    <div className="space-y-6">
      <Stepper stage={stage} onNext={() => setStage(next(stage))} onBack={() => setStage(prev(stage))} />

      {stage === 'initial' && (
        <div className="w-full max-w-3xl mx-auto px-4">
          <StoryPromptHero />
        </div>
      )}

      {stage !== 'initial' && (
        <>
          {/* Foundation: Current Story (blue), Context, Co-Pilot minimal */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="panel p-4 bg-ralph-teal/20 border border-ralph-teal/40">
              <div className="text-xs text-white/70 mb-1">Current Story</div>
              <div className="font-semibold truncate" title={concept}>{concept || 'No story yet'}</div>
              <div className="mt-2 text-xs text-white/70">Persona: {prefs.persona} • Focus: {prefs.platforms.join(', ')} • Areas: {prefs.areasOfInterest.join(', ')}</div>
            </div>
            <div className="panel p-3">
              <div className="text-xs text-white/60 mb-1">Context</div>
              <div className="flex flex-wrap gap-2 text-xs">
                {tags.length ? tags.map(t => <span key={t} className="px-2 py-1 rounded bg-white/5 border border-white/10">{t}</span>) : <span className="text-white/50">No context yet</span>}
              </div>
            </div>
            <div className="hidden lg:block"><AtAGlanceV2 /></div>
          </div>

          {/* DEBRIEF + OPPORTUNITIES */}
          <DebriefOpportunities />

          {/* Narrative foundation section */}
          <NarrativeFramework />

          {/* Depth & beyond: progressively reveal */}
          {(stage === 'depth' || stage === 'full') && (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="space-y-4"><NarrativeOverview /></div>
              <div className="space-y-4"><CoPilotChat /></div>
              <div className="space-y-4"><ScoringEnhancements /></div>
            </div>
          )}

          {stage === 'full' && (
            <>
              <ConceptCreators />
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2"><CreatorPanel /></div>
                <div><ActivityPanel /></div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Stepper({ stage, onNext, onBack }: { stage: Stage; onNext: () => void; onBack: () => void }) {
  const steps: { key: Stage; label: string }[] = [
    { key: 'initial', label: 'Initial' },
    { key: 'foundation', label: 'Narrative Foundation' },
    { key: 'depth', label: 'Depth Exploration' },
    { key: 'full', label: 'Comprehensive' },
  ]
  const idx = steps.findIndex(s => s.key === stage)
  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-white/60">
          {steps.map((s, i) => (
            <div key={s.key} className={`px-2 py-1 rounded ${i === idx ? 'bg-ralph-teal/20 border border-ralph-teal/40 text-white' : 'bg-white/5 border border-white/10'}`}>{s.label}</div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} disabled={idx<=0} className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40">Back</button>
          <button onClick={onNext} disabled={idx>=steps.length-1} className="text-xs px-2 py-1 rounded border border-white/10 bg-ralph-cyan/70 hover:bg-ralph-cyan disabled:opacity-40">Continue</button>
        </div>
      </div>
    </div>
  )
}

function next(s: Stage): Stage { return s === 'initial' ? 'foundation' : s === 'foundation' ? 'depth' : s === 'depth' ? 'full' : 'full' }
function prev(s: Stage): Stage { return s === 'full' ? 'depth' : s === 'depth' ? 'foundation' : s === 'foundation' ? 'initial' : 'initial' }
