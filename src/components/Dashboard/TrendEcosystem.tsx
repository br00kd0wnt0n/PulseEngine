import { useState } from 'react'
import TrendMap from '../TrendMap/TrendMap'

export default function TrendEcosystem({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="panel module p-4 transform-gpu">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Trend Ecosystem</div>
        <button className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setOpen(o => !o)}>{open ? 'Collapse' : 'Expand'}</button>
      </div>
      {open ? (
        <TrendMap height={420} />
      ) : (
        <div className="text-xs text-white/60">Explore how trends, creators, and content connect. Expand to interact.</div>
      )}
    </div>
  )
}
