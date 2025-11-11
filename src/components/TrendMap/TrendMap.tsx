import { useMemo, useRef, useState } from 'react'
import { TrendNode } from '../../types'
import { useTrends } from '../../context/TrendContext'
import Legend from './Legend'
import { computeMetrics } from '../../services/trends'
import { potentialColor } from '../../services/scoring'

type Props = {
  height?: number
}

// Minimal interactive SVG graph (no external libs)
export default function TrendMap({ height = 360 }: Props) {
  const { nodes, links, selectNode, selected, metricsFor } = useTrends()
  const [hover, setHover] = useState<string | null>(null)
  const [whatIf, setWhatIf] = useState<Record<string, { potential: number; longevity: number; resonance: number }>>({})

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
    const c = 2 * Math.PI * radius
    const offset = c * (1 - Math.max(0, Math.min(100, value)) / 100)
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
        style={{ transition: 'stroke-dashoffset 400ms ease' }}
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
      {selected && selected.kind === 'trend' && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Metric label="Potential" value={(whatIf[selected.id]?.potential ?? metricsFor(selected.id).potential)} />
          <Metric label="Longevity" value={(whatIf[selected.id]?.longevity ?? metricsFor(selected.id).longevity)} />
          <Metric label="Resonance" value={(whatIf[selected.id]?.resonance ?? metricsFor(selected.id).resonance)} />
          <Metric label="Velocity" value={metricsFor(selected.id).velocity} />
        </div>
      )}
      {selected && selected.kind === 'trend' && (
        <WhatIfPanel
          values={{
            potential: whatIf[selected.id]?.potential ?? Math.round(metricsFor(selected.id).potential),
            longevity: whatIf[selected.id]?.longevity ?? Math.round(metricsFor(selected.id).longevity),
            resonance: whatIf[selected.id]?.resonance ?? Math.round(metricsFor(selected.id).resonance),
          }}
          onChange={(next) => setWhatIf((m) => ({ ...m, [selected.id]: next }))}
          onReset={() => setWhatIf((m) => { const c = { ...m }; delete c[selected.id]; return c })}
        />
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel p-3">
      <div className="text-white/60 mb-1">{label}</div>
      <div className="text-lg font-semibold">{Math.round(value)}</div>
    </div>
  )
}

function WhatIfPanel({ values, onChange, onReset }: { values: { potential: number; longevity: number; resonance: number }; onChange: (v: { potential: number; longevity: number; resonance: number }) => void; onReset: () => void }) {
  return (
    <div className="mt-4 panel p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm">What‑if adjustments</div>
        <button onClick={onReset} className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10">Reset</button>
      </div>
      <Slider label="Potential" color="#EB008B" value={values.potential} onChange={(v) => onChange({ ...values, potential: v })} />
      <Slider label="Longevity" color="#8a63ff" value={values.longevity} onChange={(v) => onChange({ ...values, longevity: v })} />
      <Slider label="Resonance" color="#3be8ff" value={values.resonance} onChange={(v) => onChange({ ...values, resonance: v })} />
    </div>
  )
}

function Slider({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs text-white/70"><span>{label}</span><span>{Math.round(value)}</span></div>
      <input type="range" min={0} max={100} value={Math.round(value)} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full" style={{ accentColor: color }} />
    </div>
  )
}
