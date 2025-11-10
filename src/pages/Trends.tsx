import TrendMap from '../components/TrendMap/TrendMap'

export default function Trends() {
  return (
    <div className="space-y-6">
      <TrendMap height={520} />
      <div className="panel p-4">
        <div className="font-semibold mb-2">Cross-platform Tracking</div>
        <div className="text-sm text-white/70">Mocked view: extend with real signals (YouTube, TikTok, X) via backend adapters.</div>
      </div>
    </div>
  )
}

