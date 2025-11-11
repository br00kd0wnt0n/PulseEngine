import { useEffect, useState } from 'react'
import { api } from '../services/api'

export default function Projects() {
  const [items, setItems] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancel = false
    setLoading(true)
    fetch((import.meta as any).env?.VITE_API_BASE + '/public/projects')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { if (!cancel) setItems(d) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
    return () => { cancel = true }
  }, [])

  return (
    <div className="space-y-4">
      <div className="text-xl font-semibold">Projects</div>
      {loading && <div className="text-white/60 text-sm">Loading…</div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className="grid md:grid-cols-2 gap-3">
        {items.map(p => (
          <a href={`/projects/${p.id}`} key={p.id} className="panel p-4 block hover:bg-charcoal-700/30">
            <div className="font-medium">{p.concept}</div>
            <div className="text-xs text-white/60">Persona: {p.persona}</div>
            {p.narrative && <div className="mt-2 text-sm whitespace-pre-wrap line-clamp-5">{p.narrative}</div>}
          </a>
        ))}
      </div>
    </div>
  )
}
