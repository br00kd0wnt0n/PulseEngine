import { useState, useRef, useEffect } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { api } from '../../services/api'
import { useTrends } from '../../context/TrendContext'
import { usePreferences } from '../../context/PreferencesContext'
import { useUpload } from '../../context/UploadContext'
import { logActivity } from '../../utils/activity'

const examples = [
  {
    short: 'Multi-generational toy brand breaking into new market...',
    full: 'Social strategy for multi-generational toy brand breaking into new market: double viewership in 6 months while re-inventing legacy IP'
  },
  {
    short: 'Web-series pilot: musicians visiting guitar shops...',
    full: 'Web-series pilot: musicians visiting guitar shops after hours - scalable to merch/multi-city, attract brand partnerships for new IP'
  },
  {
    short: 'Final season Netflix campaign with behind-the-scenes...',
    full: 'Final season Netflix campaign: drive re-watch with behind-the-scenes content and exclusive new material for superfans'
  },
  {
    short: 'Video game expansion with real-world storytelling...',
    full: 'Video game expansion launch: real-world + online storytelling across platforms with unexpected brand tie-ins and niche creator collabs'
  },
]

export default function StoryPromptHero() {
  const { concept, setConcept, activated, setActivated, frameworkScores, keyDrivers, recsDensity, region, setRegion, persona, setPersona } = useDashboard()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [versions, setVersions] = useState<any[]>([])
  const [cursor, setCursor] = useState(0)
  const prefs = usePreferences()
  const { processed, addFiles, addUrl, removeContent } = useUpload()
  const [value, setValue] = useState(concept || '')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)
  const [currentMessage, setCurrentMessage] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  const messages = [
    "Share your concept and I'll help you shape it into something extraordinary",
    "Powered by a community-built database of proven work",
    "Drop files, links, and screengrabs to add context"
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % messages.length)
    }, 4000) // Change message every 4 seconds

    return () => clearInterval(interval)
  }, [])

  const { snapshot } = useTrends()

  const submit = async () => {
    const text = value.trim()
    if (!text) return
    setConcept(text)
    setActivated(true)
    try {
      localStorage.setItem('region', JSON.stringify(region))
      localStorage.setItem('persona', JSON.stringify(persona))
    } catch {}
    try { logActivity('Story assessed') } catch {}
    // Seed clarifying question into Co‑Pilot
    try {
      const p = (persona || '').toLowerCase()
      const q = p.includes('creative')
        ? `Quick clarity check (Creative Lead): What’s the first 7–10 word promise, and the pivotal moment that delivers it?`
        : p.includes('content')
        ? `Quick clarity check (Content Creator): Who are you making this for, and what’s the first 7–10 word promise they’ll see?`
        : `Quick clarity check (Strategist): Who is the primary audience and what is the first 7–10 word promise you want them to read?`
      window.dispatchEvent(new CustomEvent('open-chat'))
      window.dispatchEvent(new CustomEvent('copilot-insert', { detail: { text: q } }))
    } catch {}
    try {
      // Always try public project creation first for MVP
      const p = await api.createPublicProject({ concept: text, graph: snapshot(), focusId: null })
      if (p && p.id) {
        setProjectId(p.id)
        try { localStorage.setItem('activeProjectId', p.id) } catch {}
        // load local versions if any
        try { const local = JSON.parse(localStorage.getItem(`versions:${p.id}`) || '[]'); setVersions(local); setCursor(0) } catch {}
        try { logActivity('Project created; Quick analysis in progress') } catch {}
      }
    } catch (_e) {
      // fallback: create local project id
      const localId = `local-${Date.now()}`
      setProjectId(localId)
      try { localStorage.setItem('activeProjectId', localId) } catch {}
      setVersions([]); setCursor(0)
      try { logActivity('Local project initialized') } catch {}
    }
    const el = document.getElementById('dashboard-main')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Mark unsaved when inputs change
  useEffect(() => { if (activated) setDirty(true) }, [concept])
  useEffect(() => { if (activated) setDirty(true) }, [frameworkScores])
  useEffect(() => {
    function mark() { setDirty(true) }
    window.addEventListener('context-updated', mark as any)
    window.addEventListener('conversation-updated', mark as any)
    return () => {
      window.removeEventListener('context-updated', mark as any)
      window.removeEventListener('conversation-updated', mark as any)
    }
  }, [activated])

  function saveVersionLocal() {
    const v = {
      id: 'local-'+Date.now(),
      summary: concept,
      scores: {
        ...(frameworkScores ? { framework: frameworkScores } : {}),
        ...(keyDrivers ? { keyDrivers } : {}),
        ...(recsDensity ? { recsDensity } : {}),
      },
      createdAt: new Date().toISOString()
    }
    setVersions((vs) => [v, ...vs])
    setCursor(0)
    const pid = projectId || 'local'
    try { localStorage.setItem(`versions:${pid}`, JSON.stringify([v, ...versions])) } catch {}
    setDirty(false)
    setLastSavedAt(v.createdAt)
  }

  async function saveVersion() {
    if (projectId) {
      try {
        // Prefer local for MVP; persist locally
        saveVersionLocal()
      } catch { saveVersionLocal() }
    } else {
      saveVersionLocal()
    }
    try { logActivity('Story Breakdown complete') } catch {}
    try { logActivity('Version saved (snapshot of framework)') } catch {}
  }

  // Auto-save when dirty changes settle
  useEffect(() => {
    if (!activated || !concept) return
    if (!dirty) return
    const DEBOUNCE = Number((import.meta as any).env?.VITE_AUTO_SAVE_DEBOUNCE_MS) || 1200
    const t = setTimeout(() => {
      // basic dedupe: avoid saving identical consecutive version
      const latest = versions[0]
      const sameSummary = latest && latest.summary === concept
      const latestFramework = latest?.scores?.framework
      const sameFramework = latestFramework && frameworkScores &&
        latestFramework.market === frameworkScores.market &&
        latestFramework.narrative === frameworkScores.narrative &&
        latestFramework.commercial === frameworkScores.commercial
      const latestKD: string[] | undefined = latest?.scores?.keyDrivers
      const sameKeyDrivers = !!(latestKD && keyDrivers) && arraysEqual(latestKD, keyDrivers)
      const latestRD: any = latest?.scores?.recsDensity
      const sameRecs = !!(latestRD && recsDensity) && latestRD.narrative === recsDensity.narrative && latestRD.content === recsDensity.content && latestRD.platform === recsDensity.platform && latestRD.collab === recsDensity.collab
      if (sameSummary && (frameworkScores ? sameFramework : true) && (keyDrivers ? sameKeyDrivers : true) && (recsDensity ? sameRecs : true)) {
        setDirty(false)
        setLastSavedAt(new Date().toISOString())
        return
      }
      saveVersion()
    }, DEBOUNCE)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, concept, frameworkScores, keyDrivers, recsDensity, activated])

  function arraysEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false
    for (let i=0;i<a.length;i++) if (a[i] !== b[i]) return false
    return true
  }

  function older() {
    if (versions.length === 0) return
    setCursor((c) => Math.min(c + 1, Math.max(0, versions.length - 1)))
    const v = versions[Math.min(cursor + 1, Math.max(0, versions.length - 1))]
    if (v) setConcept(v.summary)
  }
  function newer() {
    if (versions.length === 0) return
    setCursor((c) => Math.max(0, c - 1))
    const v = versions[Math.max(0, cursor - 1)]
    if (v) setConcept(v.summary)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0

    const { files, items } = e.dataTransfer

    // Handle files
    if (files && files.length > 0) {
      addFiles(Array.from(files))
    }

    // Handle URLs from drag
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'string' && items[i].type === 'text/uri-list') {
          items[i].getAsString((url) => {
            try {
              new URL(url)
              addUrl(url)
            } catch {}
          })
        }
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text')
    // Check if pasted text is a URL
    try {
      const url = new URL(text.trim())
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        e.preventDefault()
        addUrl(text.trim())
      }
    } catch {
      // Not a URL, let default paste behavior happen
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files))
    }
  }

  if (activated && concept) {
    return (
      <div className="panel p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-white/60 mb-1">Current Story</div>
            <div className="font-semibold">{concept}</div>
            <div className="mt-2 text-xs text-white/60 flex items-center gap-2">
              <span>Persona: {persona} • Focus: {prefs.platforms.join(', ')} • Areas: {prefs.areasOfInterest.join(', ')} • Region: {region}</span>
              {dirty && <span className="px-2 py-0.5 rounded-full border border-ralph-pink/30 bg-ralph-pink/10 text-ralph-pink">Unsaved changes</span>}
            </div>
            {versions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {versions.slice(0,6).map((v, idx) => (
                  <button key={v.id}
                    onClick={() => { setConcept(v.summary); setCursor(idx) }}
                    className={`text-[11px] px-2 py-1 rounded border ${idx===cursor?'border-ralph-cyan/50 bg-ralph-cyan/10':'border-white/10 bg-white/5 hover:bg-white/10'}`}
                    title={new Date(v.createdAt).toLocaleString()}
                  >
                    v{versions.length - idx}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={older} disabled={versions.length<=1} className="whitespace-nowrap text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40">‹ Older</button>
            <button onClick={newer} disabled={versions.length<=1} className="whitespace-nowrap text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40">Newer ›</button>
            <div className="text-[11px] px-2 py-1 rounded border border-white/10 bg-white/5 text-white/60 whitespace-nowrap">
              {dirty ? 'Saving…' : 'Auto-saved'}
            </div>
            <button onClick={() => setActivated(false)} className="px-3 py-1.5 rounded text-xs border border-white/10 bg-white/5 hover:bg-white/10">Edit</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="text-center relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-ralph-pink/10 backdrop-blur-sm border-2 border-dashed border-ralph-pink rounded-2xl flex items-center justify-center animate-in fade-in duration-200">
          <div className="text-center">
            <div className="text-6xl mb-4">📎</div>
            <div className="text-2xl font-semibold text-ralph-pink">Drop your content here</div>
            <div className="text-white/60 mt-2">Files, images, links, or documents</div>
          </div>
        </div>
      )}

      {/* Claude-like greeting */}
      <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* Animated center logo */}
        <video
          className="mx-auto mb-4 w-28 md:w-36 h-auto rounded transform-gpu scale-75 mix-blend-screen"
          autoPlay
          loop
          muted
          playsInline
          aria-label="Animated logo"
        >
          <source src="/pulse_logo_pinkbluegrad.webm" type="video/webm" />
          <source src="/pulse_logo_pinkbluegrad.mp4" type="video/mp4" />
        </video>
        <h1 className="text-4xl md:text-5xl font-semibold mb-3 headline-gradient bg-clip-text text-transparent animated-gradient-text">
          What story do you want to tell?
        </h1>
        {/* Rotating messages */}
        <div className="relative h-14 flex items-center justify-center">
          {messages.map((message, index) => (
            <p
              key={index}
              className={`absolute text-white/60 text-lg transition-all duration-700 ${
                currentMessage === index
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4 pointer-events-none'
              }`}
            >
              {message}
            </p>
          ))}
        </div>
      </div>

      {/* Input area - Claude-like */}
      <div className="panel module p-6 md:p-8 transform-gpu animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
        {/* Modifiers row - Region and Persona on same level */}
        <div className="mb-3 text-left grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-white/60 mb-1">Region</div>
            <div className="flex flex-wrap gap-2">
              {(['US','UK','US+UK','Worldwide'] as const).map(r => (
                <button key={r} onClick={() => setRegion(r)} className={`text-[11px] px-2 py-1 rounded border ${region===r?'border-ralph-teal/50 bg-ralph-teal/10':'border-white/10 bg-white/5 hover:bg-white/10'}`}>{r}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Persona</div>
            <div className="flex flex-wrap gap-2">
              {(['Social Strategist', 'Creative Lead', 'Content Creator'] as const).map(p => (
                <button key={p} onClick={() => setPersona(p)} className={`text-[11px] px-2 py-1 rounded border ${persona===p?'border-ralph-teal/50 bg-ralph-teal/10':'border-white/10 bg-white/5 hover:bg-white/10'}`}>{p}</button>
              ))}
            </div>
          </div>
        </div>

        <textarea
          className="w-full bg-charcoal-800/50 border border-white/10 rounded-lg p-4 text-base placeholder-white/40 resize-none focus:border-ralph-pink/50 focus:bg-charcoal-800/70 transition-all min-h-[120px]"
          placeholder="Describe your brief, story concept or proposal vision and drag/drop any useful files..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              submit()
            }
          }}
        />

        {/* Uploaded content chips */}
        {processed.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {processed.map((item) => (
              <div
                key={item.id}
                className="group relative flex items-center gap-2 px-3 py-2 bg-charcoal-700/50 border border-white/10 rounded-lg text-xs hover:border-ralph-pink/30 transition-all"
              >
                {/* Icon based on type */}
                <span className="text-lg">
                  {item.type === 'image' ? '🖼️' : item.type === 'document' ? '📄' : item.type === 'url' ? '🔗' : '📁'}
                </span>
                {/* Preview for images */}
                {item.preview && (
                  <img src={item.preview} alt="" className="w-6 h-6 rounded object-cover" />
                )}
                <span className="text-white/80 max-w-[150px] truncate">{item.name}</span>
                {/* Remove button */}
                <button
                  onClick={() => removeContent(item.id)}
                  className="opacity-0 group-hover:opacity-100 ml-1 text-white/40 hover:text-ralph-pink transition-all"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Example prompts - 2x2 grid with truncated text */}
        <div className="mt-4 mb-4">
          <div className="text-xs text-white/50 mb-3 text-left">Try an example:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {examples.map((e, idx) => (
              <button
                key={idx}
                onClick={() => setValue(e.full)}
                className="px-3 py-2 rounded-lg text-sm text-left border border-white/10 bg-charcoal-700/30 hover:bg-charcoal-700/50 hover:border-ralph-pink/30 transition-all"
                title={e.full}
              >
                {e.short}
              </button>
            ))}
          </div>
        </div>

        {/* Submit button and upload hint */}
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-3">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.txt,.md"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-white/40 hover:text-ralph-pink flex items-center gap-1 transition-all"
              title="Upload files"
            >
              📎 Upload
            </button>
          </div>
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="px-6 py-3 rounded-lg text-sm font-medium bg-gradient-to-r from-ralph-pink to-ralph-teal hover:shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Submit + Begin
          </button>
        </div>
      </div>

      {/* Hint */}
      <div className="mt-4 text-xs text-white/40 animate-in fade-in duration-700 delay-300">
        Press <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10">⌘ Enter</kbd> or <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10">Ctrl Enter</kbd> to submit
      </div>
    </div>
  )
}
