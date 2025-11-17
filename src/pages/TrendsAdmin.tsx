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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collecting, setCollecting] = useState(false)
  const { show } = useToast()

  async function load() {
    setLoading(true); setError(null)
    try { const d = await api.statusOverview(); setData(d) } catch (e: any) { setError(String(e)) } finally { setLoading(false) }
  }

  async function collectTrends() {
    setCollecting(true)
    try {
      await api.collectTrends()
      show('Trend collection started! Check back in a few minutes.', 'success')
      await load() // Refresh data
    } catch (e: any) {
      show(`Failed to collect trends: ${e.message}`, 'error')
    } finally {
      setCollecting(false)
    }
  }

  useEffect(() => { load() }, [])

  const trendsJob: any = (data as any)?.trends?.job || {}
  const agents: any[] = (data as any)?.trends?.agents || []
  const lastRun = trendsJob.lastRun ? new Date(trendsJob.lastRun).toLocaleString() : '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-lg">Trends API Management</div>
        <div className="flex gap-2">
          <button
            onClick={collectTrends}
            disabled={collecting}
            className="text-xs px-3 py-1.5 rounded border border-white/10 bg-ralph-pink/60 hover:bg-ralph-pink disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {collecting ? 'Collecting...' : 'Collect Trends'}
          </button>
          <button onClick={load} className="text-xs px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10">Refresh</button>
        </div>
      </div>

      {loading && <div className="text-white/60 text-sm">Loading…</div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="panel p-3">
          <div className="text-xs text-white/60">Daily Job</div>
          <div className="mt-1 text-sm">Last run: {lastRun}</div>
          <div className="text-sm">Items: {trendsJob.count ?? '—'}</div>
          <div className="text-sm">Storage: {bytes(trendsJob.storageBytes)}</div>
          <div className="mt-2 text-[11px] text-white/60">Status: {trendsJob.ok ? 'OK' : 'Issues detected'}</div>
        </div>
        <div className="panel p-3 lg:col-span-2">
          <div className="text-xs text-white/60 mb-2">Agents</div>
          <div className="grid md:grid-cols-2 gap-2">
            {agents.map((a, i) => (
              <div className="panel p-2" key={i}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{a.name}</div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${a.ok?'bg-emerald-500/20 text-emerald-300':'bg-red-500/20 text-red-300'}`}>{a.ok?'OK':'Issue'}</span>
                </div>
                <div className="text-[11px] text-white/60">Status: {a.status}</div>
                <div className="text-[11px] text-white/60">Last run: {a.lastRun ? new Date(a.lastRun).toLocaleString() : '—'}</div>
                {Array.isArray(a.issues) && a.issues.length > 0 && (
                  <div className="mt-1 text-[11px] text-red-300">{a.issues.join(', ')}</div>
                )}
              </div>
            ))}
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

