import { useEffect, useState } from 'react'
import { api, StatusOverview } from '../services/api'
import { useToast } from '../context/ToastContext'

function bytes(n: number | null | undefined) {
  if (n == null) return '—'
  const units = ['B','KB','MB','GB','TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${units[i]}`
}

export default function TrendsAdmin() {
  const [data, setData] = useState<StatusOverview | null>(null)
  const [metricsSummary, setMetricsSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collecting, setCollecting] = useState(false)
  const [collectionStatus, setCollectionStatus] = useState<any>(null)
  const { show } = useToast()

  async function load() {
    setLoading(true); setError(null)
    try {
      const [overview, metrics] = await Promise.all([
        api.statusOverview(),
        api.getMetricsSummary()
      ])
      setData(overview)
      setMetricsSummary(metrics.summary)
    } catch (e: any) { setError(String(e)) } finally { setLoading(false) }
  }

  async function pollStatus() {
    try {
      const result = await api.getCollectionStatus()
      setCollectionStatus(result.status)

      // If job is running, keep polling
      if (result.status && result.status.status === 'running') {
        setTimeout(pollStatus, 2000) // Poll every 2 seconds
      } else if (result.status && result.status.status === 'completed') {
        show(`Collection complete! Saved ${result.status.totalSaved} items.`, 'success')
        await load() // Refresh overview data
      } else if (result.status && result.status.status === 'failed') {
        show('Collection failed. Check logs for details.', 'error')
      }
    } catch (e: any) {
      console.error('Failed to poll status:', e)
    }
  }

  async function collectTrends() {
    setCollecting(true)
    try {
      const result = await api.collectTrends()
      show('Trend collection started! Polling for progress...', 'success')
      setCollecting(false)

      // Start polling for status
      setTimeout(pollStatus, 1000)
    } catch (e: any) {
      show(`Failed to start collection: ${e.message}`, 'error')
      setCollecting(false)
    }
  }

  useEffect(() => {
    load()
    // Check for existing running job on mount
    pollStatus()
  }, [])

  const totalMetrics = metricsSummary?.total || 0
  const platformMetrics = metricsSummary?.byPlatform || {}
  const lastUpdate = metricsSummary?.lastUpdate ? new Date(metricsSummary.lastUpdate).toLocaleString() : '—'

  // Platform display names
  const platformNames: Record<string, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    twitter: 'Twitter',
    youtube: 'YouTube',
    news: 'News',
    wiki: 'Wikipedia',
    fandom: 'Fandom'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-lg">Trends API Management</div>
        <div className="flex gap-2">
          <button
            onClick={collectTrends}
            disabled={collecting || (collectionStatus && collectionStatus.status === 'running')}
            className="text-xs px-3 py-1.5 rounded border border-white/10 bg-ralph-pink/60 hover:bg-ralph-pink disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {collecting ? 'Starting...' : (collectionStatus && collectionStatus.status === 'running') ? 'Collecting...' : 'Collect Trends'}
          </button>
          <button onClick={load} className="text-xs px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10">Refresh</button>
        </div>
      </div>

      {loading && <div className="text-white/60 text-sm">Loading…</div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Real-time Collection Progress */}
      {collectionStatus && collectionStatus.status === 'running' && (
        <div className="panel p-4 border-2 border-ralph-pink/50">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-ralph-pink">Collection in Progress</div>
            <div className="text-xs text-white/60">{collectionStatus.progress}% complete</div>
          </div>

          {/* Overall Progress Bar */}
          <div className="w-full bg-white/10 rounded-full h-2 mb-4">
            <div
              className="bg-ralph-pink h-2 rounded-full transition-all duration-300"
              style={{ width: `${collectionStatus.progress}%` }}
            />
          </div>

          {/* Individual Actor Status */}
          <div className="space-y-2">
            {collectionStatus.actors.map((actor: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 flex-1">
                  <span className="w-24 text-white/80">{actor.platform}</span>
                  <span className={`px-1.5 py-0.5 rounded ${
                    actor.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                    actor.status === 'running' ? 'bg-ralph-pink/20 text-ralph-pink' :
                    actor.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                    'bg-white/10 text-white/60'
                  }`}>
                    {actor.status}
                  </span>
                  {actor.status === 'running' && (
                    <div className="flex gap-0.5">
                      <div className="w-1 h-1 bg-ralph-pink rounded-full animate-pulse" />
                      <div className="w-1 h-1 bg-ralph-pink rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <div className="w-1 h-1 bg-ralph-pink rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                  )}
                </div>
                <div className="text-white/60">
                  {actor.status === 'completed' && `${actor.itemsSaved} items`}
                  {actor.status === 'failed' && actor.error}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-[11px] text-white/60">
            Total saved: {collectionStatus.totalSaved} items
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="panel p-3">
          <div className="text-xs text-white/60">Collection Summary</div>
          <div className="mt-1 text-sm">Last updated: {lastUpdate}</div>
          <div className="text-sm">Total items: {totalMetrics.toLocaleString()}</div>
          <div className="mt-2 text-[11px] text-white/60">
            Status: {totalMetrics > 0 ? 'Data Available' : 'No data yet'}
          </div>
        </div>
        <div className="panel p-3 lg:col-span-2">
          <div className="text-xs text-white/60 mb-2">Platform Metrics</div>
          <div className="grid md:grid-cols-2 gap-2">
            {Object.entries(platformNames).map(([key, name]) => {
              const count = platformMetrics[key] || 0
              const hasData = count > 0
              return (
                <div className="panel p-2" key={key}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{name}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${hasData ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/60'}`}>
                      {hasData ? 'OK' : 'No data'}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/60">Items: {count.toLocaleString()}</div>
                  {hasData && (
                    <div className="text-[11px] text-emerald-300">Last updated: {lastUpdate}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="panel p-3">
        <div className="text-xs text-white/60 mb-1">Database Tables</div>
        <div className="space-y-1 text-sm">
          {(data?.database?.tables || []).map((t) => (
            <div key={t.name} className="flex items-center justify-between">
              <div className="text-white/80">{t.name}</div>
              <div className="text-white/60">{bytes((t as any).bytes)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

