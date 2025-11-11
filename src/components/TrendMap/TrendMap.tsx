import { useMemo, useRef, useState, useEffect } from 'react'
import { TrendNode } from '../../types'
import { useTrends } from '../../context/TrendContext'
import Legend from './Legend'
import { computeMetrics } from '../../services/trends'
import { potentialColor } from '../../services/scoring'
import { useToast } from '../../context/ToastContext'

type Props = {
  height?: number
}

// Minimal interactive SVG graph (no external libs)
export default function TrendMap({ height = 360 }: Props) {
  const { nodes, links, selectNode, selected, metricsFor } = useTrends()
  const { snapshot } = useTrends()
  const [hover, setHover] = useState<string | null>(null)
  const [whatIf, setWhatIf] = useState<Record<string, { potential: number; longevity: number; resonance: number }>>({})
  const { show } = useToast()

  // Load saved what-if values per trend id
  useEffect(() => {
    if (selected && selected.kind === 'trend') {
      try {
        const raw = localStorage.getItem(`whatif:${selected.id}`)
        if (raw) {
          const vals = JSON.parse(raw)
          setWhatIf((m) => ({ ...m, [selected.id]: vals }))
        }
      } catch {}
    }
  }, [selected?.id])

  const box = { w: 800, h: height }

  // Place nodes in simple concentric bands by type
  const placed = useMemo(() => {
    const center = { x: box.w / 2, y: box.h / 2 }
    const radii = { trend: box.h * 0.3, creator: box.h * 0.45, content: box.h * 0.58 }
    const byType: Record<string, TrendNode[]> = { trend: [], creator: [], content: [] }
    nodes.forEach(n => byType[n.kind].push(n))
    const coords: Record<string, { x: number; y: number }> = {}
    ;(['trend','creator','content'] as const).forEach((kind) => {
      const list = byType[kind]
      const r = radii[kind]
      list.forEach((n, i) => {
        const a = (i / list.length) * Math.PI * 2
        coords[n.id] = { x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r }
      })
    })
    return coords
  }, [nodes, box.h, box.w])

  const color = (k: TrendNode['kind']) => k === 'trend' ? '#EB008B' : k === 'creator' ? '#8a63ff' : '#3be8ff'

  function Ring({ value, radius, color, width = 3 }: { value: number; radius: number; color: string; width?: number }) {
    const [display, setDisplay] = useState(0)
    useEffect(() => {
      // animate from 0 to target on mount and on value change
      const id = requestAnimationFrame(() => setDisplay(value))
      return () => cancelAnimationFrame(id)
    }, [value])
    const c = 2 * Math.PI * radius
    const pct = Math.max(0, Math.min(100, display))
    const offset = c * (1 - pct / 100)
    return (
      <circle
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90)"
        style={{ transition: 'stroke-dashoffset 600ms ease' }}
        opacity={0.9}
      />
    )
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Trend Visualization</div>
        <Legend />
      </div>
      <div className="overflow-auto">
        <svg width={box.w} height={box.h} className="bg-charcoal-900/40 rounded-lg border border-white/5">
          {/* Links */}
          {links.map((l, idx) => {
            const s = placed[l.source]
            const t = placed[l.target]
            if (!s || !t) return null
            return (
              <line
                key={idx}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={1}
              />
            )
          })}
          {/* Nodes */}
          {nodes.map((n) => {
            const p = placed[n.id]
            if (!p) return null
            const isSel = selected?.id === n.id
            const isHover = hover === n.id
            const r = isSel ? 9 : 6
            const base = metricsFor(n.id)
            const override = whatIf[n.id]
            const metrics = override ? { ...base, ...override } : base
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`}>
                {/* Activity-style rings for trend metrics */}
                {n.kind === 'trend' && (
                  <g>
                    {/* Glow overlays when what‑if increases */}
                    {metrics.potential > base.potential && (
                      <circle r={r + 8} fill="none" stroke="#EB008B" strokeWidth={5} opacity={0.4} className="ring-glow" transform="rotate(-90)" />
                    )}
                    {metrics.longevity > base.longevity && (
                      <circle r={r + 5} fill="none" stroke="#8a63ff" strokeWidth={5} opacity={0.4} className="ring-glow" transform="rotate(-90)" />
                    )}
                    {metrics.resonance > base.resonance && (
                      <circle r={r + 2} fill="none" stroke="#3be8ff" strokeWidth={5} opacity={0.4} className="ring-glow" transform="rotate(-90)" />
                    )}
                    <Ring value={metrics.potential} radius={r + 8} color="#EB008B" width={3} />
                    <Ring value={metrics.longevity} radius={r + 5} color="#8a63ff" width={3} />
                    <Ring value={metrics.resonance} radius={r + 2} color="#3be8ff" width={3} />
                  </g>
                )}
                <circle
                  r={r}
                  fill={color(n.kind)}
                  className={`transition-all duration-200 ${isSel || isHover ? 'drop-shadow-[0_0_10px_rgba(138,99,255,0.7)]' : ''}`}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => selectNode(n.id)}
                />
                {(isSel || isHover) && (
                  <g transform={`translate(10,-10)`}>
                    <rect rx="6" ry="6" x="0" y="-28" width="220" height="56" fill="rgba(17,18,23,0.95)" stroke="rgba(255,255,255,0.08)" />
                    <text x="8" y="-8" fill="#fff" fontSize="11" fontFamily="ui-sans-serif, system-ui">{n.label}</text>
                    <text x="8" y="10" fill="#b0b0b0" fontSize="10" fontFamily="ui-sans-serif, system-ui">Potential {Math.round(metrics.potential)} • Longevity {Math.round(metrics.longevity)}</text>
                    <text x="8" y="24" fill="#808080" fontSize="10" fontFamily="ui-sans-serif, system-ui">Resonance {Math.round(metrics.resonance)} • Velocity {Math.round(base.velocity)}</text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      {selected && selected.kind === 'trend' && (() => {
        const baseM = metricsFor(selected.id)
        const cur = {
          potential: (whatIf[selected.id]?.potential ?? baseM.potential),
          longevity: (whatIf[selected.id]?.longevity ?? baseM.longevity),
          resonance: (whatIf[selected.id]?.resonance ?? baseM.resonance),
        }
        return (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Metric label="Potential" value={cur.potential} base={Math.round(baseM.potential)} />
            <Metric label="Longevity" value={cur.longevity} base={Math.round(baseM.longevity)} />
            <Metric label="Resonance" value={cur.resonance} base={Math.round(baseM.resonance)} />
            <Metric label="Velocity" value={baseM.velocity} />
          </div>
        )
      })()}
      {selected && selected.kind === 'trend' && (
        <WhatIfPanel
          values={{
            potential: whatIf[selected.id]?.potential ?? Math.round(metricsFor(selected.id).potential),
            longevity: whatIf[selected.id]?.longevity ?? Math.round(metricsFor(selected.id).longevity),
            resonance: whatIf[selected.id]?.resonance ?? Math.round(metricsFor(selected.id).resonance),
          }}
          base={{
            potential: Math.round(metricsFor(selected.id).potential),
            longevity: Math.round(metricsFor(selected.id).longevity),
            resonance: Math.round(metricsFor(selected.id).resonance),
          }}
          onChange={(next) => setWhatIf((m) => ({ ...m, [selected.id]: next }))}
          onReset={() => {
            setWhatIf((m) => { const c = { ...m }; delete c[selected.id]; return c })
            try { localStorage.removeItem(`whatif:${selected.id}`) } catch {}
            show('Cleared What‑if', 'info')
          }}
          onSave={async () => {
            try {
              const vals = whatIf[selected.id] || { potential: Math.round(metricsFor(selected.id).potential), longevity: Math.round(metricsFor(selected.id).longevity), resonance: Math.round(metricsFor(selected.id).resonance) }
              const concept = `What-if: Adjusted ${selected.label} P/L/R ${vals.potential}/${vals.longevity}/${vals.resonance}`
              await (await import('../../services/api')).api.createPublicProject({ concept, graph: snapshot(), adjustments: { trendId: selected.id, ...vals } })
              try { localStorage.setItem(`whatif:${selected.id}`, JSON.stringify(vals)) } catch {}
              show('Saved What‑if as Project', 'success')
            } catch (e: any) {
              show('Failed to save What‑if', 'error')
            }
          }}
        />
      )}
    </div>
  )
}

function Metric({ label, value, base }: { label: string; value: number; base?: number }) {
  const delta = base == null ? 0 : Math.round(value - base)
  const deltaLabel = base == null ? '' : delta === 0 ? '±0' : delta > 0 ? `+${delta}` : `${delta}`
  const deltaClass = delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-red-300' : 'text-white/60'
  return (
    <div className="panel p-3">
      <div className="text-white/60 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <div className="text-lg font-semibold">{Math.round(value)}</div>
        {base != null && (
          <span className={`px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-xs ${deltaClass}`}>{deltaLabel}</span>
        )}
      </div>
    </div>
  )
}

function WhatIfPanel({ values, base, onChange, onReset, onSave }: { values: { potential: number; longevity: number; resonance: number }; base: { potential: number; longevity: number; resonance: number }; onChange: (v: { potential: number; longevity: number; resonance: number }) => void; onReset: () => void; onSave: () => void }) {
  return (
    <div className="mt-4 panel p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm">What‑if adjustments</div>
        <div className="flex gap-2">
          <button onClick={onReset} className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10">Reset</button>
          <button onClick={onSave} className="text-xs px-2 py-1 rounded border border-white/10 bg-ralph-pink/60 hover:bg-ralph-pink">Save What‑if as Project</button>
        </div>
      </div>
      <Slider label="Potential" color="#EB008B" value={values.potential} onChange={(v) => onChange({ ...values, potential: v })} base={base.potential} />
      <Slider label="Longevity" color="#8a63ff" value={values.longevity} onChange={(v) => onChange({ ...values, longevity: v })} base={base.longevity} />
      <Slider label="Resonance" color="#3be8ff" value={values.resonance} onChange={(v) => onChange({ ...values, resonance: v })} base={base.resonance} />
    </div>
  )
}

function Slider({ label, value, onChange, color, base }: { label: string; value: number; onChange: (v: number) => void; color: string; base?: number }) {
  const delta = base == null ? 0 : Math.round(value - base)
  const deltaLabel = delta === 0 ? '±0' : delta > 0 ? `+${delta}` : `${delta}`
  const deltaClass = delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-red-300' : 'text-white/60'
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs text-white/70">
        <span>{label}</span>
        <span className={`px-1.5 py-0.5 rounded bg-white/5 border border-white/10 ${deltaClass}`}>{deltaLabel}</span>
      </div>
      <input type="range" min={0} max={100} value={Math.round(value)} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full" style={{ accentColor: color }} />
    </div>
  )
}
