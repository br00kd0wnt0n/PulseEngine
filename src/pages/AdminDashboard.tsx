import { useEffect, useMemo, useState } from 'react'
import { api, StatusOverview } from '../services/api'

function bytes(n: number | null) {
  if (n == null) return '—'
  const units = ['B','KB','MB','GB','TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${units[i]}`
}

export default function AdminDashboard() {
  const [data, setData] = useState<StatusOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    api.statusOverview()
      .then(d => { if (mounted) { setData(d); setError(null) } })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
    return () => { mounted = false }
  }, [])

  return (
    <div className="space-y-6">
      <div className="panel module p-4">
        <div className="font-semibold mb-3">Service Status</div>
        {loading ? (<div className="text-white/60 text-sm">Loading…</div>) : error ? (
          <div className="text-red-400 text-sm">{error}</div>
        ) : data ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <ServiceCard name="API" ok={data.services.api.ok} detail={data.services.api.status} />
            <ServiceCard name="Database" ok={true} detail={`Size ${bytes(data.database.sizeBytes)}`} />
          </div>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="panel module p-4">
          <div className="font-semibold mb-3">Usage & Tables</div>
          {data ? (
            <div className="space-y-2 text-sm">
              {data.database.tables.map(t => (
                <div key={t.name} className="flex items-center justify-between">
                  <div className="text-white/70">{t.name}</div>
                  <div className="text-white/60">{bytes(t.bytes)}</div>
                </div>
              ))}
            </div>
          ) : <div className="text-white/60 text-sm">—</div>}
        </div>

        <div className="panel module p-4">
          <div className="font-semibold mb-3">User & Content Stats</div>
          {data ? (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Users" value={data.stats.users} />
              <Stat label="Creators" value={data.stats.creators} />
              <Stat label="Trends" value={data.stats.trends} />
              <Stat label="Assets" value={data.stats.assets} />
            </div>
          ) : <div className="text-white/60 text-sm">—</div>}
        </div>
      </div>
    </div>
  )
}

function ServiceCard({ name, ok, detail }: { name: string; ok: boolean; detail?: string }) {
  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">{name}</div>
        <span className={`px-2 py-0.5 rounded text-xs ${ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>{ok ? 'OK' : 'Down'}</span>
      </div>
      {detail && <div className="text-xs text-white/60 mt-1">{detail}</div>}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="panel p-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  )
}

