import { useEffect, useMemo, useState } from 'react'
import Tooltip from '../shared/Tooltip'
import { useDashboard } from '../../context/DashboardContext'
import { useTrends } from '../../context/TrendContext'
import { api } from '../../services/api'
import { scoreConcept } from '../../services/scoring'
import { logActivity } from '../../utils/activity'

export default function AtAGlanceV2() {
  const { concept } = useDashboard()
  const { snapshot } = useTrends()
  const [vals, setVals] = useState<{ narrative: number; peak: number; cross: number }>({ narrative: 0, peak: 0, cross: 0 })
  const [prev, setPrev] = useState<{ narrative?: number; peak?: number; cross?: number }>({})
  const [howText, setHowText] = useState('')

  const [refreshKey, setRefreshKey] = useState(0)
  const analysis = useMemo(() => scoreConcept(concept || 'AI loop dance challenge', snapshot(), []), [concept, snapshot, refreshKey])

  useEffect(() => {
    function bump(e?: Event) {
      setRefreshKey((k) => k + 1)
      const reason = e?.type === 'conversation-updated' ? 'user input' : 'context'
      try { logActivity(`Quick analysis updated based on ${reason}`) } catch {}
    }
    window.addEventListener('context-updated', bump as any)
    window.addEventListener('conversation-updated', bump as any)
    return () => {
      window.removeEventListener('context-updated', bump as any)
      window.removeEventListener('conversation-updated', bump as any)
    }
  }, [])

  useEffect(() => {
    const narrative = Math.round(analysis.scores.narrativeStrength)
    const peak = Math.max(1, Math.round(analysis.scores.timeToPeakWeeks))
    const text = (concept || '').toLowerCase()
    const platforms = ['tiktok', 'shorts', 'reels']
    const hits = platforms.filter(p => text.includes(p)).length
    const cross = Math.min(100, hits * 30 + 40)
    setPrev((p) => ({ narrative: vals.narrative, peak: vals.peak, cross: vals.cross }))
    setVals({ narrative, peak, cross })
    try {
      logActivity('Quick analysis created')
      logActivity('Narrative potential calculated')
    } catch {}
  }, [analysis, concept])

  // AI one-liner (non-blocking): grab first sentence from narrative; fallback if needed
  useEffect(() => {
    let cancel = false
    setHowText('Analyzing story fit…')
    ;(async () => {
      try {
        const n = await api.narrative(snapshot(), null)
        if (cancel) return
        const text = (n as any).text || ''
        const first = (text.split(/\.[\s\n]/)[0] || '').trim()
        if (first) setHowText(first)
        else {
          const c = (concept || 'this story').replace(/\s+/g, ' ').trim()
          setHowText(`Quick look at Narrative Potential, Time to Peak, and Cross‑platform fit for “${c}”.`)
        }
      } catch {
        const c = (concept || 'this story').replace(/\s+/g, ' ').trim()
        setHowText(`Quick look at Narrative Potential, Time to Peak, and Cross‑platform fit for “${c}”.`)
      }
    })()
    return () => { cancel = true }
  }, [concept, snapshot])

  return (
    <div className="panel module p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold">Quick Analysis</div>
      </div>
      <div className="mb-3 text-[12px] text-white/70">{howText}</div>
      <div className="grid sm:grid-cols-3 gap-3">
        <KpiCard label="Narrative Potential" value={vals.narrative} prev={prev.narrative} tooltip="How strong this story reads at a glance." color="#EB008B" />
        <KpiCard label="Time to Peak" value={vals.peak} prev={prev.peak} unit="wks" tooltip="Estimated weeks until the concept crests." color="#8a63ff" />
        <KpiCard label="Cross‑platform" value={vals.cross} prev={prev.cross} tooltip="Fit across TikTok, Shorts, and Reels." color="#3be8ff" />
      </div>
    </div>
  )
}

function KpiCard({ label, value, prev, unit, tooltip, color }: { label: string; value: number; prev?: number; unit?: string; tooltip?: string; color: string }) {
  const pct = Math.max(0, Math.min(100, value))
  const circumference = 2 * Math.PI * 22
  const offset = circumference * (1 - (pct / 100))
  const d = typeof prev === 'number' ? Math.round(value - prev) : 0
  const showDelta = typeof prev === 'number' && d !== 0
  const deltaClass = d > 0 ? 'border-ralph-pink/40 bg-ralph-pink/10 text-ralph-pink' : 'border-ralph-cyan/40 bg-ralph-cyan/10 text-ralph-cyan'
  return (
    <div className="panel p-3 flex items-center gap-3">
      <svg width="54" height="54" className="shrink-0">
        <circle cx="27" cy="27" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
        <circle cx="27" cy="27" r="22" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 27 27)" />
        <text x="27" y="31" textAnchor="middle" fill="#fff" fontSize="11" fontFamily="ui-sans-serif, system-ui">{unit ? value : Math.round(value)}</text>
      </svg>
      <div>
        <div className="text-xs text-white/60 flex items-center gap-2">
          {label}
          {showDelta && <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${deltaClass}`}>{d > 0 ? `+${d}` : d}</span>}
          {tooltip && <Tooltip label={label}><span className="text-white/80">{tooltip}</span></Tooltip>}
        </div>
        {!unit && <div className="text-xl font-semibold">{Math.round(value)}</div>}
        {unit && <div className="text-xl font-semibold">{value} <span className="text-sm text-white/60">{unit}</span></div>}
      </div>
    </div>
  )}
