import { useEffect, useMemo, useState } from 'react'
import Tooltip from '../shared/Tooltip'
import { useDashboard } from '../../context/DashboardContext'
import { useTrends } from '../../context/TrendContext'
import { scoreConcept } from '../../services/scoring'

export default function AtAGlanceV2() {
  const { concept } = useDashboard()
  const { snapshot } = useTrends()
  const [vals, setVals] = useState<{ narrative: number; peak: number; cross: number }>({ narrative: 0, peak: 0, cross: 0 })
  const [howOpen, setHowOpen] = useState(false)

  const analysis = useMemo(() => scoreConcept(concept || 'AI loop dance challenge', snapshot(), []), [concept, snapshot])

  useEffect(() => {
    const narrative = Math.round(analysis.scores.narrativeStrength)
    const peak = Math.max(1, Math.round(analysis.scores.timeToPeakWeeks))
    // crude cross-platform readiness estimate from concept keywords
    const text = (concept || '').toLowerCase()
    const platforms = ['tiktok', 'shorts', 'reels']
    const hits = platforms.filter(p => text.includes(p)).length
    const cross = Math.min(100, hits * 30 + 40)
    setVals({ narrative, peak, cross })
  }, [analysis, concept])

  return (
    <div className="panel module p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">At‑a‑Glance</div>
        <div className="flex items-center gap-2">
          <button className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => {
            const el = document.getElementById('calc'); if (el) el.scrollIntoView({ behavior: 'smooth' })
          }}>Go to Calculator</button>
          <button className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setHowOpen(o => !o)}>How it works</button>
        </div>
      </div>
      {howOpen && (
        <div className="mb-3 text-[12px] bg-white/5 border border-white/10 rounded p-3">
          We analyze your story for: Narrative Potential (how strong the story reads), Time to Peak (when it’s likely to crest), and Cross‑platform Readiness (fit across TikTok/Shorts/Reels). Submit your story, then use the calculator for deeper guidance.
        </div>
      )}
      <div className="grid sm:grid-cols-3 gap-3">
        <KpiCard label="Narrative Potential" value={vals.narrative} tooltip="How strong this story reads at a glance." color="#EB008B" />
        <KpiCard label="Time to Peak" value={vals.peak} unit="wks" tooltip="Estimated weeks until the concept crests." color="#8a63ff" />
        <KpiCard label="Cross‑platform" value={vals.cross} tooltip="Fit across TikTok, Shorts, and Reels." color="#3be8ff" />
      </div>
    </div>
  )
}

function KpiCard({ label, value, unit, tooltip, color }: { label: string; value: number; unit?: string; tooltip?: string; color: string }) {
  const pct = Math.max(0, Math.min(100, value))
  const circumference = 2 * Math.PI * 22
  const offset = circumference * (1 - (pct / 100))
  return (
    <div className="panel p-3 flex items-center gap-3">
      <svg width="54" height="54" className="shrink-0">
        <circle cx="27" cy="27" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
        <circle cx="27" cy="27" r="22" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 27 27)" />
        <text x="27" y="31" textAnchor="middle" fill="#fff" fontSize="11" fontFamily="ui-sans-serif, system-ui">{unit ? value : Math.round(value)}</text>
      </svg>
      <div>
        <div className="text-xs text-white/60 flex items-center">
          {label}
          {tooltip && <Tooltip label={label}><span className="text-white/80">{tooltip}</span></Tooltip>}
        </div>
        {!unit && <div className="text-xl font-semibold">{Math.round(value)}</div>}
        {unit && <div className="text-xl font-semibold">{value} <span className="text-sm text-white/60">{unit}</span></div>}
      </div>
    </div>
  )}
