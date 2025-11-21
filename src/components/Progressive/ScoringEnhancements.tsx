import { useEffect, useMemo, useState } from 'react'
import { api } from '../../services/api'
import { useDashboard } from '../../context/DashboardContext'
import { useTrends } from '../../context/TrendContext'
import { logActivity } from '../../utils/activity'
import Tooltip from '../shared/Tooltip'

export default function ScoringEnhancements() {
  const { concept } = useDashboard()
  const { snapshot } = useTrends() as any
  const [score, setScore] = useState<any | null>(null)
  const [lastExt, setLastExt] = useState<any | null>(null)
  const [updatedAfterApply, setUpdatedAfterApply] = useState<boolean>(false)
  const [enh, setEnh] = useState<{ suggestions: { text: string; target: string; impact: number }[] } | null>(null)
  const graph = useMemo(() => snapshot(), [snapshot])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    if (!concept) return
    setScore(null); setEnh(null)
    ;(async () => {
      try {
        const region = (localStorage.getItem('region') || '').replace(/"/g,'')
        const persona = (localStorage.getItem('persona') || '').replace(/"/g,'')
        const mods = [region?`Region: ${region}`:'', persona?`Persona: ${persona}`:''].filter(Boolean).join('; ')
        const modConcept = mods ? `${concept} (${mods})` : concept
        const targetAudience = (localStorage.getItem('targetAudience') || '').replace(/"/g,'')
        const pid = localStorage.getItem('activeProjectId') || undefined
        const [s, e] = await Promise.all([
          api.score(concept, graph, { persona, region, projectId: pid, targetAudience }),
          api.enhancements(modConcept, graph)
        ])
        if (!cancel) {
          setScore(s); setEnh(e)
          setError(null)
          logActivity('Scores updated')
          // persist compact score snapshot for co‑pilot guidance
          try {
            const pid = localStorage.getItem('activeProjectId') || 'local'
            const ext = s?.extended || {}
            const snap = {
              narrative: s?.scores?.narrativeStrength,
              ttpWeeks: s?.scores?.timeToPeakWeeks,
              cross: ext?.crossPlatformPotential ?? s?.ralph?.crossPlatformPotential,
              commercial: ext?.commercialPotential,
              overall: ext?.overall,
            }
            localStorage.setItem(`score:${pid}`, JSON.stringify(snap))
          } catch {}
        }
      } catch (e) {
        if (!cancel) { setScore(null); setError('Scores not available'); }
      }
    })()
    return () => { cancel = true }
  }, [concept, graph])

  async function applySuggestion(text: string) {
    try {
      // capture current snapshot for delta display (using same format as localStorage)
      if (score) {
        const ext = score?.extended || {}
        const snap = {
          narrative: score?.scores?.narrativeStrength,
          ttpWeeks: score?.scores?.timeToPeakWeeks,
          cross: ext?.crossPlatformPotential ?? score?.ralph?.crossPlatformPotential,
          commercial: ext?.commercialPotential,
          overall: ext?.overall,
        }
        setLastExt(snap)
      }
      setUpdatedAfterApply(true)
      window.dispatchEvent(new CustomEvent('copilot-insert', { detail: { text } }))
      window.dispatchEvent(new CustomEvent('conversation-updated'))
      logActivity(`Applied enhancement: ${text}`)
      // re-score after a short delay
      setTimeout(async () => {
        try {
          const region = (localStorage.getItem('region') || '').replace(/"/g,'')
          const persona = (localStorage.getItem('persona') || '').replace(/"/g,'')
          const mods = [region?`Region: ${region}`:'', persona?`Persona: ${persona}`:''].filter(Boolean).join('; ')
          const modConcept = mods ? `${concept} (${mods})` : concept
          const targetAudience = (localStorage.getItem('targetAudience') || '').replace(/"/g,'')
          const pid = localStorage.getItem('activeProjectId') || undefined
          const s = await api.score(concept, graph, { persona, region, projectId: pid, targetAudience })
          setScore(s)
          logActivity('Scores recalculated after enhancement')
          try {
            const pid = localStorage.getItem('activeProjectId') || 'local'
            const ext = s?.extended || {}
            const snap = {
              narrative: s?.scores?.narrativeStrength,
              ttpWeeks: s?.scores?.timeToPeakWeeks,
              cross: ext?.crossPlatformPotential ?? s?.ralph?.crossPlatformPotential,
              commercial: ext?.commercialPotential,
              overall: ext?.overall,
            }
            localStorage.setItem(`score:${pid}`, JSON.stringify(snap))
          } catch {}
        } catch {}
      }, 800)
    } catch {}
  }

  const ext = score?.extended || {}
  return (
    <div className="panel module p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">SCORING <span className="text-white/30">|</span> ENHANCEMENTS</div>
        <div className="flex items-center gap-2">
          {updatedAfterApply && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/60">Updated after apply</span>
          )}
          {typeof ext.overall === 'number' && <div className="text-xs text-white/60">Overall {ext.overall}</div>}
        </div>
      </div>
      {!score && (
        <div className="text-xs text-white/60 mb-2">{error ? error : 'Scoring concept and computing targeted enhancements…'}</div>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Metric label="Narrative" value={score?.scores?.narrativeStrength} previousValue={lastExt?.narrative} delta={diff(score?.scores?.narrativeStrength, lastExt?.narrative)} tips={score?.rationales?.narrative} />
          <Metric label="Time to Peak" value={score?.scores?.timeToPeakWeeks} previousValue={lastExt?.ttpWeeks} unit="wks" delta={diff(score?.scores?.timeToPeakWeeks, lastExt?.ttpWeeks)} tips={score?.rationales?.timing} />
          <Metric label="Cross‑platform" value={score?.ralph?.crossPlatformPotential} previousValue={lastExt?.cross} delta={diff(ext?.crossPlatformPotential, lastExt?.cross)} tips={score?.rationales?.cross} />
          <Metric label="Commercial" value={ext?.commercialPotential} previousValue={lastExt?.commercial} delta={diff(ext?.commercialPotential, lastExt?.commercial)} tips={score?.rationales?.commercial} />
        </div>
        <div className="space-y-2">
          <div className="text-xs text-white/60 mb-1">Targeted Enhancements</div>
          <div className="space-y-2">
            {enh?.suggestions?.map((s: any, i) => (
              <button key={i} onClick={() => {
                applySuggestion(s.text)
                if (s.target) {
                  try { window.dispatchEvent(new CustomEvent('nf-apply', { detail: { target: s.target, text: s.text } })) } catch {}
                }
              }} className="w-full text-left panel p-2 hover:bg-white/10">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-white/90">{s.text}</div>
                  <div className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5">{impactBadge(s)}</div>
                </div>
                <div className="text-[11px] text-white/50">Target: {s.target}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rationale tooltips reduce clutter; shown inline per metric */}

      {/* Evidence chips */}
      {Array.isArray((score as any)?.evidence) && (score as any).evidence.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-white/60 mb-1">Evidence</div>
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            {(score as any).evidence.slice(0,6).map((e: string, i: number) => (
              <span key={i} className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{e}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function impactBadge(s: any) {
  const d = s?.deltas
  if (d && (d.narrative || d.ttp || d.cross || d.commercial)) {
    const metrics = []
    if (d.narrative) metrics.push({ label: 'Narrative', value: d.narrative, key: 'N' })
    if (d.ttp) metrics.push({ label: 'Timing', value: d.ttp, key: 'T' })
    if (d.cross) metrics.push({ label: 'Cross-platform', value: d.cross, key: 'X' })
    if (d.commercial) metrics.push({ label: 'Commercial', value: d.commercial, key: 'C' })

    return (
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {metrics.map((m, i) => (
          <span
            key={i}
            className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10"
            title={`${m.label} impact: ${fmt(m.value)}`}
          >
            <span className="text-white/50">{m.label}</span>
            <span className={`ml-1 font-medium ${m.value > 0 ? 'text-ralph-cyan' : 'text-red-400'}`}>
              {fmt(m.value)}
            </span>
          </span>
        ))}
      </div>
    )
  }
  return <span className="text-[10px] text-white/40">No impact data</span>
}

function fmt(n: number) { return n>0?`+${n}`:`${n}` }

function diff(curr?: number, prev?: number) {
  if (typeof curr !== 'number' || typeof prev !== 'number') return undefined
  const d = Math.round(curr - prev)
  return d === 0 ? undefined : d
}

function Metric({ label, value, unit, delta, previousValue, tips }: { label: string; value?: number; unit?: string; delta?: number; previousValue?: number; tips?: string[] }) {
  if (typeof value !== 'number') return (
    <div className="panel p-2">
      <div className="text-xs text-white/60 flex items-center gap-1">
        <span>{label}</span>
        {Array.isArray(tips) && tips.length > 0 && (
          <Tooltip label={`Why: ${label}`}>
            <ul className="list-disc pl-4 space-y-0.5">
              {tips.slice(0,3).map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </Tooltip>
        )}
      </div>
      <div className="text-sm text-white/50">—</div>
    </div>
  )
  const pct = unit === 'wks' ? Math.max(0, Math.min(100, 100 - (value - 1) * 12)) : Math.max(0, Math.min(100, value))
  const prevPct = typeof previousValue === 'number'
    ? (unit === 'wks' ? Math.max(0, Math.min(100, 100 - (previousValue - 1) * 12)) : Math.max(0, Math.min(100, previousValue)))
    : null

  return (
    <div className="panel p-2">
      <div className="text-xs text-white/60 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span>{label}</span>
          {Array.isArray(tips) && tips.length > 0 && (
            <Tooltip label={`Why: ${label}`}>
              <ul className="list-disc pl-4 space-y-0.5">
                {tips.slice(0,3).map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </Tooltip>
          )}
          {typeof delta === 'number' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${delta>0?'border-ralph-pink/40 bg-ralph-pink/10 text-ralph-pink':'border-ralph-cyan/40 bg-ralph-cyan/10 text-ralph-cyan'}`}>{fmt(delta)}</span>
          )}
        </span>
        {unit ? <span className="text-white/70">{value} {unit}</span> : <span className="text-white/70">{Math.round(value)}</span>}
      </div>
      <div className="mt-1 h-2 rounded bg-charcoal-700/50 relative">
        <div className="h-2 rounded accent-gradient" style={{ width: `${pct}%` }} />
        {prevPct !== null && (
          <div
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${prevPct}%`, transform: 'translateX(-50%)' }}
          >
            <div className="text-white/40 text-[10px] leading-none" style={{ marginTop: '-12px' }}>▼</div>
          </div>
        )}
      </div>
    </div>
  )
}
