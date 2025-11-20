import { useTheme } from '../../context/ThemeContext'
import { Link } from 'react-router-dom'
import { useLayout } from '../../context/LayoutContext'
import { useUpload } from '../../context/UploadContext'
// import LogoMark from '../LogoMark'

import { useState, useEffect } from 'react'
import { api } from '../../services/api'

export default function Topbar() {
  const { dark, toggle } = useTheme()
  const { toggleSidebar } = useLayout()
  const { processed } = useUpload()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ trends: any[]; creators: any[]; assets: any[] }>({ trends: [], creators: [], assets: [] })

  // Read project info from localStorage
  const [concept, setConcept] = useState('')
  const [persona, setPersona] = useState('')
  const [region, setRegion] = useState('')

  useEffect(() => {
    // Initial read
    const updateFromLocalStorage = () => {
      setConcept(localStorage.getItem('concept') || '')
      setPersona(localStorage.getItem('persona') || '')
      setRegion(localStorage.getItem('region') || '')
    }

    updateFromLocalStorage()

    // Poll for changes every 500ms
    const interval = setInterval(updateFromLocalStorage, 500)

    return () => clearInterval(interval)
  }, [])

  let timer: any
  async function runSearch(text: string) {
    const query = text.trim()
    if (timer) clearTimeout(timer)
    if (!query) { setResults({ trends: [], creators: [], assets: [] }); setOpen(false); return }
    setLoading(true)
    timer = setTimeout(async () => {
      try {
        const data = await api.search(query)
        setResults({
          trends: Array.isArray(data?.trends) ? data.trends.slice(0,10) : [],
          creators: Array.isArray(data?.creators) ? data.creators.slice(0,10) : [],
          assets: Array.isArray(data?.assets) ? data.assets.slice(0,10) : [],
        })
        setOpen(true)
      } catch {
        setResults({ trends: [], creators: [], assets: [] })
        setOpen(true)
      } finally { setLoading(false) }
    }, 200)
  }
  // Check if uploads are still being assessed
  const hasPlaceholders = (files: any[]) => files.some(f => f.summary === '[processing]')
  const showIndexingStatus = processed.length > 0 && hasPlaceholders(processed)

  // Truncate long concepts intelligently
  const truncateConcept = (text: string, maxLength: number = 60): string => {
    if (!text || text.length <= maxLength) return text

    // Try to find a natural break point (comma, period, semicolon)
    const truncated = text.substring(0, maxLength)
    const lastBreak = Math.max(
      truncated.lastIndexOf(','),
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf(';')
    )

    if (lastBreak > maxLength * 0.6) {
      return truncated.substring(0, lastBreak).trim() + '…'
    }

    // Otherwise truncate at last space
    const lastSpace = truncated.lastIndexOf(' ')
    if (lastSpace > maxLength * 0.6) {
      return truncated.substring(0, lastSpace).trim() + '…'
    }

    // Fallback: hard truncate
    return truncated.trim() + '…'
  }

  const displayConcept = truncateConcept(concept)

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
      <div className="bg-gradient-to-r from-ralph-pink to-ralph-teal">
        {/* Main navigation row */}
        <div className="px-4 md:px-8 py-3 flex items-center gap-3 text-white">
          <button onClick={toggleSidebar} className="px-2 py-1 rounded-md border border-white/20 bg-white/10 hover:bg-white/15" aria-label="Navigation">
            ☰
          </button>
          <Link to="/" className="flex items-center gap-3">
            <div className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>ralph</div>
            <div className="hidden md:block h-6 w-px bg-white/30" />
            <div className="hidden md:block font-semibold tracking-wide uppercase text-xs">Storytelling Intelligence</div>
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
                      <div key={'t'+i} className="px-2 py-1 rounded hover:bg-white/10 cursor-pointer">{t.label || t.name}</div>
                    )) : <div className="px-2 py-1 text-white/40">No trends</div>}
                    <div className="mt-2 mb-1 text-white/60">Creators</div>
                    {results.creators.length ? results.creators.map((c:any,i:number)=> (
                      <div key={'c'+i} className="px-2 py-1 rounded hover:bg-white/10 cursor-pointer">{c.name || c.handle}</div>
                    )) : <div className="px-2 py-1 text-white/40">No creators</div>}
                    <div className="mt-2 mb-1 text-white/60">Assets</div>
                    {results.assets.length ? results.assets.map((a:any,i:number)=> (
                      <div key={'a'+i} className="px-2 py-1 rounded hover:bg-white/10 cursor-pointer">{a.name || a.filename}</div>
                    )) : <div className="px-2 py-1 text-white/40">No assets</div>}
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

        {/* Project information row */}
        {(concept || persona || region || showIndexingStatus) && (
          <div className="px-4 md:px-8 pb-3 pt-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                {concept && (
                  <div
                    className="px-2 py-1 rounded bg-ralph-cyan/20 border border-ralph-cyan/40 text-white max-w-md truncate"
                    title={concept}
                  >
                    {displayConcept}
                  </div>
                )}
                {persona && (
                  <div className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white whitespace-nowrap">
                    Persona: {persona}
                  </div>
                )}
                {region && (
                  <div className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white whitespace-nowrap">
                    Region: {region}
                  </div>
                )}
              </div>
            </div>
            {showIndexingStatus && (
              <div className="mt-2 text-[10px] text-white/80 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ralph-cyan animate-pulse" />
                <span>Indexing uploaded context… Debrief will appear once ready.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
