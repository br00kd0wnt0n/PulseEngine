import { useEffect, useState } from 'react'
import { api } from '../services/api'

export default function Projects() {
  const [items, setItems] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  function loadProjects() {
    let cancel = false
    setLoading(true)
    fetch((import.meta as any).env?.VITE_API_BASE + '/public/projects')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { if (!cancel) setItems(d) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
    return () => { cancel = true }
  }

  useEffect(() => {
    return loadProjects()
  }, [])

  async function clearAllProjects() {
    if (!confirm('Are you sure you want to delete ALL projects? This cannot be undone.')) return
    setDeleting(true)
    try {
      const response = await fetch((import.meta as any).env?.VITE_API_BASE + '/admin/projects/clear-all', {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete projects')
      setItems([])
      alert('All projects deleted successfully')
    } catch (e: any) {
      alert('Failed to delete projects: ' + e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">Projects</div>
        <button
          onClick={clearAllProjects}
          disabled={deleting || items.length === 0}
          className="text-xs px-3 py-1.5 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {deleting ? 'Deleting...' : 'Clear All Projects'}
        </button>
      </div>
      {loading && <div className="text-white/60 text-sm">Loading…</div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}
      {items.length === 0 && !loading && !error && (
        <div className="panel p-8 text-center text-white/60">
          <div className="text-lg mb-2">No projects yet</div>
          <div className="text-sm">Create a new project from the Dashboard to get started</div>
        </div>
      )}
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
