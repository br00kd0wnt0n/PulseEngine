import { useEffect, useMemo, useState } from 'react'
import StoryPromptHero from '../components/Dashboard/StoryPromptHero'
import NarrativeFramework from '../components/CoPilot/NarrativeFramework'
import CoPilotChat from '../components/CoPilot/CoPilotChat'
import CreatorPanel from '../components/Dashboard/CreatorPanel'
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

  // Subtle auto-scroll when stage advances to reveal new sections
  useEffect(() => {
    const id = stage === 'foundation' ? 'anchor-debrief' : stage === 'depth' ? 'anchor-scoring' : stage === 'full' ? 'anchor-concept' : ''
    if (!id) return
    const t = setTimeout(() => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => clearTimeout(t)
  }, [stage])

  // Co‑Pilot guidance prompts per stage + idle follow-ups
  useEffect(() => {
    let idleTimer: any = null
    function say(text: string) {
      try { window.dispatchEvent(new CustomEvent('copilot-say', { detail: { text } })) } catch {}
    }
    function getPid() { try { return localStorage.getItem('activeProjectId') || 'local' } catch { return 'local' } }
    function readJSON(key: string) { try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null } }
    const pid = getPid()
    const deb = readJSON(`debrief:${pid}`)
    const opps = readJSON(`opps:${pid}`)
    const nf = readJSON(`nf:${pid}`) as any[] | null
    const score = readJSON(`score:${pid}`) as { narrative?: number; ttpWeeks?: number; cross?: number; commercial?: number; overall?: number } | null
    const topOpps = ((opps?.opportunities || []) as any[]).slice(0,2).map(o => o.title).filter(Boolean)
    const did = (deb?.didYouKnow || []) as string[]
    const emptyNodes = (Array.isArray(nf) ? nf : []).filter(b => !String(b?.content || '').trim()).map(b => b?.title).filter(Boolean)
    // Stage-specific primary prompt
    if (stage === 'foundation') {
      const oppHint = topOpps.length ? ` For example: ${topOpps.join(', ')}.` : ''
      say(`Read the DEBRIEF + OPPORTUNITIES I put together.${oppHint} Decide if you want to integrate any of the ideas — I can update the narrative for you.`)
      const didHint = did[0] ? ` “${did[0]}” might spark something.` : ' there might be something that sparks an idea.'
      idleTimer = setTimeout(() => say(`Check out the DID YOU KNOWs —${didHint}`), 20000)
    } else if (stage === 'depth') {
      const missing = emptyNodes.slice(0,2)
      const missingHint = missing.length ? ` I still need: ${missing.join(', ')}.` : ''
      // Score-aware hinting
      let scoreHint = ''
      if (score) {
        const tips: string[] = []
        if (typeof score.narrative === 'number' && score.narrative < 60) tips.push('narrative is a bit low — we can tighten the hook')
        if (typeof score.cross === 'number' && score.cross < 60) tips.push('cross‑platform fit is moderate — we can add native cues')
        if (typeof score.commercial === 'number' && score.commercial < 60) tips.push('commercial potential could improve — stronger collab prompts may help')
        if (typeof score.ttpWeeks === 'number' && score.ttpWeeks > 6) tips.push('time‑to‑peak looks longer — a loopable beat could speed it up')
        if (tips.length) scoreHint = ` Also, ${tips[0]}.`
      }
      say(`Now review the Narrative Deconstruction.${missingHint}${scoreHint} If you agree, continue; if not, click Edit on any node to refine and Save — I will reassess scores and suggestions.`)
      idleTimer = setTimeout(() => say(`Want me to propose a tighter hook or a clearer pivot? Tell me, and I’ll integrate it into the framework.`), 20000)
    } else if (stage === 'full') {
      say(`Here’s a synthesized concept proposal with top creators attached. Feel free to adjust any narrative nodes and I’ll keep this updated.`)
    }
    function resetIdle() { if (idleTimer) { clearTimeout(idleTimer); idleTimer = null } }
    window.addEventListener('conversation-updated', resetIdle as any)
    window.addEventListener('context-updated', resetIdle as any)
    return () => {
      if (idleTimer) clearTimeout(idleTimer)
      window.removeEventListener('conversation-updated', resetIdle as any)
      window.removeEventListener('context-updated', resetIdle as any)
    }
  }, [stage])

  const tags = Array.from(new Set(processed.flatMap(p => p.tags))).slice(0, 16)

  return (
    <div className="space-y-6">
      {stage !== 'initial' && <Stepper stage={stage} onNext={() => setStage(next(stage))} onBack={() => setStage(prev(stage))} />}

      {stage === 'initial' && (
        <div className="w-full max-w-3xl mx-auto px-4">
          <StoryPromptHero />
        </div>
      )}

      {stage !== 'initial' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Foundation: Current Story (blue), Context */}
            <div className="grid lg:grid-cols-2 gap-6">
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
            </div>
            {/* DEBRIEF + OPPORTUNITIES */}
            <div id="anchor-debrief"><DebriefOpportunities /></div>
            {/* Narrative Framework */}
            <NarrativeFramework />
            {/* Depth & beyond */}
            {(stage === 'depth' || stage === 'full') && (
              <div id="anchor-scoring"><ScoringEnhancements /></div>
            )}
            {stage === 'full' && (
              <>
                <div id="anchor-concept"><ConceptCreators /></div>
                <CreatorPanel />
              </>
            )}
          </div>
          {/* Side Co‑Pilot */}
          <div className="space-y-4">
            <div className="sticky top-20 space-y-4">
              <CoPilotChat />
              <ActivityPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stepper({ stage, onNext, onBack }: { stage: Stage; onNext: () => void; onBack: () => void }) {
  const steps: { key: Stage; label: string }[] = [
    { key: 'initial', label: 'Brief' },
    { key: 'foundation', label: 'Narrative Foundation' },
    { key: 'depth', label: 'Strategic Refinement' },
    { key: 'full', label: 'Full Proposal' },
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
