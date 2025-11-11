import { useState } from 'react'
import Tooltip from '../shared/Tooltip'
import ProjectPotentialCalculator from './ProjectPotentialCalculator'
import { useDashboard } from '../../context/DashboardContext'

const platforms = ['TikTok','YouTube Shorts','Instagram Reels']

export default function GuidedCalculator() {
  const { concept, setConcept } = useDashboard()
  const [step, setStep] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  return (
    <div className="panel module p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Project Potential</div>
        <div className="text-xs text-white/60">Step {step} of 3</div>
      </div>

      {step === 1 && (
        <div className="mt-3">
          <div className="text-xs text-white/60 mb-2">Describe your story idea in one sentence.</div>
          <textarea className="w-full bg-charcoal-800/70 border border-white/10 rounded p-2 text-sm" rows={3} placeholder="e.g., AI loop + dance challenge with retro edits" value={concept} onChange={(e) => setConcept(e.target.value)} />
          <div className="mt-2 flex justify-end"><button className="text-xs px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setStep(2)}>Next</button></div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-3">
          <div className="text-xs text-white/60 mb-2">Select target platforms (optional).</div>
          <div className="flex flex-wrap gap-2">
            {platforms.map(p => (
              <button key={p} onClick={() => setSelected((s) => s.includes(p) ? s.filter(x => x!==p) : [...s,p])} className={`text-xs px-2 py-1 rounded border ${selected.includes(p) ? 'border-ralph-pink bg-ralph-pink/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>{p}</button>
            ))}
          </div>
          <div className="mt-2 flex justify-between">
            <button className="text-xs px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setStep(1)}>Back</button>
            <button className="text-xs px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setStep(3)}>See Insights</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-3 space-y-2">
          <div className="text-xs text-white/60 flex items-center">We analyze reach, narrative, timing, and collab fit<Tooltip label="How we score"><span>Audience Potential = reach likelihood. Narrative Strength = clarity + hook. Time to Peak = when it’s likely to hit. Collab Opportunity = creator fit potential.</span></Tooltip></div>
          <ProjectPotentialCalculator />
          <div className="flex justify-between">
            <button className="text-xs px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setStep(2)}>Back</button>
          </div>
        </div>
      )}
    </div>
  )
}

