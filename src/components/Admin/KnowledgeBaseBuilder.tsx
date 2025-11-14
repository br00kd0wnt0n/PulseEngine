import { useEffect, useMemo, useState } from 'react'

export default function KnowledgeBaseBuilder() {
  const [files, setFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Brief')
  const [source, setSource] = useState('')
  const [conf, setConf] = useState('Internal')
  const [quality, setQuality] = useState('Strong')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<any[]>([])

  // Helper function to clean up redundant tags
  function cleanTags(tags: any[]): string[] {
    const rawTags = Object.values(tags || {}).filter(Boolean) as string[]
    const cleaned = new Set<string>()

    // Build set of simplified tags
    rawTags.forEach(tag => {
      const lower = String(tag).toLowerCase()
      // Convert MIME types to simple extensions
      if (lower === 'application/pdf') {
        cleaned.add('pdf')
      } else if (lower.startsWith('application/') || lower.startsWith('image/') || lower.startsWith('text/')) {
        // Skip other MIME types if we already have a simple version
        const ext = lower.split('/')[1]
        if (ext) cleaned.add(ext)
      } else {
        cleaned.add(tag)
      }
    })

    return Array.from(cleaned)
  }

  // Load existing items from database
  useEffect(() => {
    async function loadAssets() {
      try {
        const response = await fetch('https://api-production-768d.up.railway.app/admin/assets')
        if (!response.ok) return

        const data = await response.json()
        const assets = data.assets || []

        // Convert database assets to items format
        const dbItems = assets.map((asset: any) => ({
          id: asset.id,
          title: asset.name,
          type: 'Industry Data',
          source: 'Uploaded',
          conf: 'Public',
          quality: 'Good',
          tags: cleanTags(asset.tags || {}),
          notes: '',
          files: [{ name: asset.name, size: 0, type: 'application/pdf' }],
          createdAt: asset.createdAt,
        }))

        setItems(dbItems)
      } catch (error) {
        console.error('Failed to load assets:', error)
        setItems([])
      }
    }
    loadAssets()

    // Refresh when uploads happen
    const handleContextUpdate = () => loadAssets()
    window.addEventListener('context-updated', handleContextUpdate)
    return () => window.removeEventListener('context-updated', handleContextUpdate)
  }, [])

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
      const next = [item, ...arr]
      localStorage.setItem(key, JSON.stringify(next))
      setItems(next)
    } catch {}
    setFiles([]); setTitle(''); setSource(''); setTags(''); setNotes('')
}

function pieColor(i: number) {
  const colors = ['#EB008B', '#8a63ff', '#3be8ff', '#f59e0b', '#10b981', '#f87171']
  return colors[i % colors.length]
}

function PieChart({ stats }: { stats: Record<string, number> }) {
  const entries = Object.entries(stats).sort((a,b)=>b[1]-a[1])
  const total = entries.reduce((s, [,v]) => s+v, 0) || 1
  const size = 140
  const r = 54
  const cx = size/2
  const cy = size/2
  const stroke = 32
  const circ = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {/* background circle */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        {entries.map(([label, value], i) => {
          const frac = value / total
          const len = frac * circ
          const dash = `${len} ${circ - len}`
          const el = (
            <circle
              key={label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={pieColor(i)}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          )
          offset += len
          return el
        })}
      </g>
    </svg>
  )
}

  const typeStats = useMemo(() => {
    const map: Record<string, number> = {}
    for (const it of items) {
      const t = String(it.type || 'Other')
      map[t] = (map[t] || 0) + 1
    }
    return map
  }, [items])
  const totals = useMemo(() => {
    let filesCount = 0
    for (const it of items) filesCount += Array.isArray(it.files) ? it.files.length : 0
    return { items: items.length, files: filesCount }
  }, [items])

  return (
    <div className="panel module p-4">
      <div className="font-semibold mb-2">Ralph Knowledge Base (RKB)</div>
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
          {/* Live stats */}
          <div className="mt-3 panel p-3">
            <div className="text-xs text-white/60 mb-2">Knowledge Base Stats</div>
            <div className="flex flex-wrap gap-2 text-[11px] mb-2">
              <span className="px-2 py-1 rounded border border-white/10 bg-white/5">Items: {totals.items}</span>
              <span className="px-2 py-1 rounded border border-white/10 bg-white/5">Files: {totals.files}</span>
            </div>
            <div className="grid md:grid-cols-2 gap-3 items-center">
              <PieChart stats={typeStats} />
              <div className="space-y-1 text-[11px]">
                {Object.entries(typeStats).sort((a,b)=>b[1]-a[1]).map(([k,v], i) => {
                  const total = Object.values(typeStats).reduce((s,n)=>s+n,0) || 1
                  const pct = Math.round((v/total)*100)
                  const color = pieColor(i)
                  return (
                    <div key={k} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded" style={{ background: color }} />
                        <span className="text-white/80">{k}</span>
                      </div>
                      <div className="text-white/60">{v} • {pct}%</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
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
            <option>Ralph Doc</option>
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
