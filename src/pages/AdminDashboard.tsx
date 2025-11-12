import { useEffect, useMemo, useState } from 'react'
import { api, StatusOverview } from '../services/api'
import { useToast } from '../context/ToastContext'

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
  const { show } = useToast()

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
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Service Status</div>
          <div className="flex gap-2">
            <button className="px-2 py-1 text-xs rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={async () => {
              setLoading(true)
              try {
                const pf = await api.preflight()
                if (pf.ok) show('Preflight OK ✅', 'success')
                else show(`Preflight issues: ${(pf.issues||[]).length}`, 'error')
              } catch (e:any) {
                show('Preflight failed', 'error')
              } finally { setLoading(false) }
            }}>Run Preflight</button>
            <button className="px-2 py-1 text-xs rounded border border-white/10 bg-ralph-pink/60 hover:bg-ralph-pink" onClick={async () => {
              setLoading(true)
              try {
                const r = await api.adminSeed({ dry: false, withAI: true })
                const res = (r.result || r)
                const msg = res && res.trends != null ? `Seeded T${res.trends}/C${res.creators}/A${res.assets}` : 'Seed complete'
                show(msg, 'success')
              } catch (e:any) {
                show('Seed failed', 'error')
              } finally { setLoading(false) }
            }}>Load Demo Data</button>
          </div>
        </div>
        {loading ? (<div className="text-white/60 text-sm">Loading…</div>) : error ? (
          <div className="text-red-400 text-sm">{error}</div>
        ) : data ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <ServiceCard name="Core API" ok={data.services.api.ok} detail={data.services.api.status} />
            <ServiceCard name="Ingestion" ok={!!(data as any).services?.ingestion?.ok} detail={(data as any).services?.ingestion?.status || '—'} />
            <ServiceCard name="AI Connection" ok={!!(data as any).services?.ai?.ok} detail={`${(data as any).services?.ai?.provider || '—'} • ${(data as any).services?.ai?.model || '—'}`} />
          </div>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="panel module p-4">
          <div className="font-semibold mb-3">Usage & Tables</div>
          {data && Array.isArray(data.database?.tables) ? (
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

      <div className="panel module p-4">
        <div className="font-semibold mb-2">Architecture & Data Sources</div>
        <div className="text-xs text-white/70 leading-relaxed">
          Core API orchestrates projects, scoring, and recommendations. Ingestion service (configurable) handles document and URL parsing for context. AI connection uses a provider/model configured via environment variables to generate narratives and framework scores. Live datasets (creators, trends, assets) are loaded via seed or ingestion and will expand to external APIs in production.
        </div>
        <div className="mt-2 text-xs text-white/60">Planned data/API integrations: TikTok/YouTube/Instagram trend signals, creator metrics, and analytics overlays. Vector search (pgvector) for retrieval-augmented generation (RAG).</div>
      </div>

      <KnowledgeBaseBuilder />
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

function KnowledgeBaseBuilder() {
  const [files, setFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Brief')
  const [source, setSource] = useState('')
  const [conf, setConf] = useState('Internal')
  const [quality, setQuality] = useState('Strong')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation()
    const fs = Array.from(e.dataTransfer.files || [])
    if (fs.length) setFiles(prev => [...prev, ...fs])
  }
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length) setFiles(prev => [...prev, ...Array.from(e.target.files!)])
  }
  function save() {
    const key = 'rag:items'
    const item = {
      id: 'rag-'+Date.now(), title: title.trim() || (files[0]?.name || 'Untitled'),
      type, source, conf, quality, tags: tags.split(',').map(x => x.trim()).filter(Boolean), notes,
      files: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
      createdAt: new Date().toISOString(),
    }
    try {
      const arr = JSON.parse(localStorage.getItem(key) || '[]')
      localStorage.setItem(key, JSON.stringify([item, ...arr]))
    } catch {}
    setFiles([]); setTitle(''); setSource(''); setTags(''); setNotes('')
  }
  const items = (() => { try { return JSON.parse(localStorage.getItem('rag:items') || '[]') } catch { return [] } })()

  return (
    <div className="panel module p-4">
      <div className="font-semibold mb-2">Ralph Knowledge Base (RAG)</div>
      <div className="text-xs text-white/60 mb-3">Drop briefs, proposals, case studies, industry data, and screengrabs to grow the internal knowledge base. These will inform AI assessment of user stories.</div>
      <div className="grid lg:grid-cols-3 gap-4 text-sm">
        <div className="lg:col-span-2">
          <div
            onDrop={onDrop} onDragOver={(e) => { e.preventDefault() }}
            className="h-28 border border-dashed border-white/15 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10"
          >
            <div className="text-white/60 text-xs">
              Drag & drop documents, PDFs, images here or
              <label className="ml-1 text-ralph-pink underline cursor-pointer">
                choose files
                <input type="file" multiple className="hidden" onChange={onPick} accept="image/*,.pdf,.doc,.docx,.txt,.md" />
              </label>
            </div>
          </div>
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((f, i) => <span key={i} className="px-2 py-1 text-xs rounded border border-white/10 bg-white/5">{f.name}</span>)}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Title" className="w-full bg-charcoal-800/70 border border-white/10 rounded px-2 py-1" />
          <select value={type} onChange={(e)=>setType(e.target.value)} className="w-full bg-charcoal-800/70 border border-white/10 rounded px-2 py-1">
            <option>Brief</option>
            <option>Concept</option>
            <option>Proposal</option>
            <option>Industry Data</option>
            <option>Case Study</option>
            <option>Screengrab</option>
          </select>
          <input value={source} onChange={(e)=>setSource(e.target.value)} placeholder="Source / URL" className="w-full bg-charcoal-800/70 border border-white/10 rounded px-2 py-1" />
          <select value={conf} onChange={(e)=>setConf(e.target.value)} className="w-full bg-charcoal-800/70 border border-white/10 rounded px-2 py-1">
            <option>Internal</option>
            <option>Client Confidential</option>
            <option>Public</option>
          </select>
          <select value={quality} onChange={(e)=>setQuality(e.target.value)} className="w-full bg-charcoal-800/70 border border-white/10 rounded px-2 py-1">
            <option>Strong</option>
            <option>Good</option>
            <option>Reference</option>
          </select>
          <input value={tags} onChange={(e)=>setTags(e.target.value)} placeholder="Tags (comma separated)" className="w-full bg-charcoal-800/70 border border-white/10 rounded px-2 py-1" />
          <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Notes / why this is good" className="w-full bg-charcoal-800/70 border border-white/10 rounded px-2 py-1" rows={3} />
          <button onClick={save} className="w-full text-xs px-2 py-1 rounded border border-white/10 bg-ralph-cyan/70 hover:bg-ralph-cyan">Add to Knowledge Base</button>
        </div>
      </div>
      <div className="mt-4">
        <div className="text-xs text-white/60 mb-2">Recent Knowledge</div>
        {items.length === 0 && <div className="text-xs text-white/50">No items yet.</div>}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          {items.map((it: any) => (
            <div key={it.id} className="panel p-3">
              <div className="font-medium text-sm truncate" title={it.title}>{it.title}</div>
              <div className="text-xs text-white/60 mt-0.5">{it.type} • {it.conf} • {new Date(it.createdAt).toLocaleDateString()}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(it.tags||[]).map((t: string, i: number) => <span key={i} className="px-1.5 py-0.5 rounded text-[10px] border border-white/10 bg-white/5">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
