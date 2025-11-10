import TrendMap from '../TrendMap/TrendMap'

export default function TrendEcosystem() {
  return (
    <div className="panel module p-4 transform-gpu">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Trend Ecosystem</div>
        <div className="text-xs text-white/60">Interactive connections</div>
      </div>
      <TrendMap height={420} />
    </div>
  )
}
