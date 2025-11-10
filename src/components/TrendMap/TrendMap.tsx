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
            const metrics = metricsFor(n.id)
            const ringColor = potentialColor(metrics.potential)
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`}>
                {/* Potential ring for narrative potential */}
                {n.kind === 'trend' && (
                  <circle r={r + 5} fill="none" stroke={ringColor} strokeOpacity={0.6} strokeWidth={2} />
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
                    <text x="8" y="24" fill="#808080" fontSize="10" fontFamily="ui-sans-serif, system-ui">Resonance {Math.round(metrics.resonance)} • Velocity {Math.round(metrics.velocity)}</text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      {selected && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Metric label="Potential" value={metricsFor(selected.id).potential} />
          <Metric label="Longevity" value={metricsFor(selected.id).longevity} />
          <Metric label="Resonance" value={metricsFor(selected.id).resonance} />
          <Metric label="Velocity" value={metricsFor(selected.id).velocity} />
        </div>
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
