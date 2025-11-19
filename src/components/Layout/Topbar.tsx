import { useTheme } from '../../context/ThemeContext'
import { Link } from 'react-router-dom'
import { useLayout } from '../../context/LayoutContext'
import LogoMark from '../LogoMark'

import { useState } from 'react'
import { api } from '../../services/api'

export default function Topbar() {
  const { dark, toggle } = useTheme()
  const { toggleSidebar } = useLayout()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ trends: any[]; creators: any[]; assets: any[] }>({ trends: [], creators: [], assets: [] })

  async function runSearch(text: string) {
    const query = text.trim()
    if (!query) { setResults({ trends: [], creators: [], assets: [] }); return }
    setLoading(true)
    try {
      // MVP: fetch public lists and filter client-side; replace with backend search endpoint when ready
      const [trends, creators] = await Promise.all([api.trends().catch(()=>[]), api.creators().catch(()=>[])])
      const ql = query.toLowerCase()
      const t = (trends||[]).filter((t: any) => String(t.label||'').toLowerCase().includes(ql)).slice(0,10)
      const c = (creators||[]).filter((c: any) => String(c.name||'').toLowerCase().includes(ql)).slice(0,10)
      setResults({ trends: t, creators: c, assets: [] })
      setOpen(true)
    } finally { setLoading(false) }
  }
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
      <div className="bg-gradient-to-r from-ralph-pink to-ralph-teal">
        <div className="px-4 md:px-8 py-3 flex items-center gap-3 text-white">
          <button onClick={toggleSidebar} className="px-2 py-1 rounded-md border border-white/20 bg-white/10 hover:bg-white/15" aria-label="Navigation">
            ☰
          </button>
          <Link to="/" className="flex items-center gap-3">
            <LogoMark size={32} className="" />
            <div className="hidden sm:block font-semibold tracking-wide uppercase text-xs">Storytelling Intelligence</div>
          </Link>
          <div className="relative flex-1 max-w-2xl ml-auto">
            <input
              className="w-full bg-black/20 border border-white/20 text-white placeholder-white/70 rounded-lg py-2.5 pl-10 pr-3 text-sm focus-visible:shadow-glow"
              placeholder="Search trends, creators, content..."
              value={q}
              onChange={(e) => { setQ(e.target.value); runSearch(e.target.value) }}
              onFocus={() => q && setOpen(true)}
              onBlur={() => setTimeout(()=>setOpen(false), 150)}
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/80">⌘K</div>
            {open && (
              <div className="absolute mt-1 left-0 right-0 bg-charcoal-800/95 border border-white/10 rounded-lg p-2 text-xs text-white/80 max-h-80 overflow-auto z-50">
                {loading ? (
                  <div className="p-2">Searching…</div>
                ) : (
                  <>
                    <div className="mb-1 text-white/60">Trends</div>
                    {results.trends.length ? results.trends.map((t:any,i:number)=> (
                      <div key={'t'+i} className="px-2 py-1 rounded hover:bg-white/10 cursor-pointer">{t.label}</div>
                    )) : <div className="px-2 py-1 text-white/40">No trends</div>}
                    <div className="mt-2 mb-1 text-white/60">Creators</div>
                    {results.creators.length ? results.creators.map((c:any,i:number)=> (
                      <div key={'c'+i} className="px-2 py-1 rounded hover:bg-white/10 cursor-pointer">{c.name}</div>
                    )) : <div className="px-2 py-1 text-white/40">No creators</div>}
                  </>
                )}
              </div>
            )}
          </div>
          <button
            onClick={toggle}
            className="ml-2 px-3 py-2 rounded-md text-sm border border-white/20 bg-white/10 hover:bg-white/15"
          >
            {dark ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>
    </header>
  )
}
