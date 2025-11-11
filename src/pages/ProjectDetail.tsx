import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

export default function ProjectDetail() {
  const { id } = useParams()
  const [item, setItem] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(((import.meta as any).env?.VITE_API_BASE || '') + `/public/projects/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setItem)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-white/60 text-sm">Loading…</div>
  if (error) return <div className="text-red-400 text-sm">{error}</div>
  if (!item) return <div className="text-white/60 text-sm">Not found</div>

  return (
    <div className="space-y-4">
      <div className="text-xl font-semibold">{item.concept}</div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="panel p-4">
          <div className="font-semibold mb-2">Narrative</div>
          <div className="text-sm whitespace-pre-wrap">{item.narrative || '—'}</div>
        </div>
        <div className="panel p-4">
          <div className="font-semibold mb-2">Scores</div>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(item.scores, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
