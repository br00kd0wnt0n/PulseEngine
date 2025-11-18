import { useEffect, useMemo, useRef, useState } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { useUpload } from '../../context/UploadContext'
import { logActivity, readActivity } from '../../utils/activity'

export default function CoPilotChat() {
  useDashboard() // ensure context exists; no quick wins for now
  const { processed, addFiles, addUrl } = useUpload()
  const [items, setItems] = useState<any[]>([])
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const inputRef = useRef<HTMLInputElement|null>(null)
  const fileRef = useRef<HTMLInputElement|null>(null)
  const activeProjectId = useMemo(() => {
    try { return localStorage.getItem('activeProjectId') || 'local' } catch { return 'local' }
  }, [])

  useEffect(() => {
    const key = `conv:${activeProjectId}`
    try { const arr = JSON.parse(localStorage.getItem(key) || '[]'); setItems(arr) } catch {}
  }, [activeProjectId])


  async function send() {
    const content = text.trim()
    if (!content) return
    setText('')
    const key = `conv:${activeProjectId}`
    const msg = { id: 'local-'+Date.now(), role: 'user', content, createdAt: new Date().toISOString() }
    setItems((it) => {
      const next = [...it, msg]
      try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
      return next
    })
    try { window.dispatchEvent(new CustomEvent('conversation-updated')) } catch {}
    try { logActivity('User message posted; updating recommendations') } catch {}
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation()
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length) addFiles(files)
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const t = e.clipboardData.getData('text')
    try {
      const u = new URL(t)
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        e.preventDefault(); addUrl(t)
      }
    } catch {}
  }

  useEffect(() => {
    const wsUrl = (import.meta as any).env?.VITE_WS_URL
    if (!wsUrl) return
    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(wsUrl)
      ws.onmessage = (ev) => {
        // simple passthrough: any message triggers a refresh
        try { window.dispatchEvent(new CustomEvent('conversation-updated')) } catch {}
      }
    } catch {}
    return () => { try { ws?.close() } catch {} }
  }, [])

  // Accept insert events from NarrativeFramework and others
  useEffect(() => {
    function onInsert(e: any) {
      const txt = e?.detail?.text
      if (typeof txt === 'string' && txt.trim()) {
        setText((t) => (t ? `${t}\n${txt}` : txt))
        inputRef.current?.focus()
      }
    }
    window.addEventListener('copilot-insert' as any, onInsert as any)
    return () => window.removeEventListener('copilot-insert' as any, onInsert as any)
  }, [])

  // Accept say events to append AI guidance messages
  useEffect(() => {
    function onSay(e: any) {
      const content = (e?.detail?.text || '').trim()
      if (!content) return

      // Show typing indicator
      setTyping(true)

      // Wait a moment then add message
      setTimeout(() => {
        const key = `conv:${activeProjectId}`
        const msg = { id: 'ai-'+Date.now(), role: 'ai', content, createdAt: new Date().toISOString() }
        setItems((it) => {
          const next = [...it, msg]
          try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
          return next
        })
        setTyping(false)
      }, 800)
    }
    window.addEventListener('copilot-say' as any, onSay as any)
    return () => window.removeEventListener('copilot-say' as any, onSay as any)
  }, [activeProjectId])

  return (
    <div className="panel module p-4 bg-ralph-teal/10 animated-gradient-border" onDrop={onDrop} onDragOver={(e)=>e.preventDefault()}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">AI Co‑Pilot</div>
        <div className="text-[11px] text-white/60">Drag files/URLs into this window to add context</div>
      </div>
      {/* Context tags */}
      <div className="mb-2 flex flex-wrap gap-2">
        {Array.from(new Set(processed.flatMap(p => p.tags))).slice(0, 20).map((t) => (
          <span key={t} className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[11px]">{t}</span>
        ))}
      </div>
      <div>
          <div className="h-[28rem] md:h-[32rem] overflow-auto space-y-2 text-sm bg-charcoal-800/40 rounded p-2 border border-white/5">
            {items.length === 0 && (
              <div className="text-white/50 text-sm">Start the conversation — ask for hooks, beats, or creator approaches.</div>
            )}
            {items.map((m, i) => (
              <div key={m.id || i} className={`p-2 rounded ${m.role === 'user' ? 'bg-white/5' : 'bg-ralph-purple/10'}`}>{m.content}</div>
            ))}
            {typing && (
              <div className="p-2 rounded bg-ralph-purple/10 text-white/50 text-xs italic animate-pulse">
                Co-pilot typing...
              </div>
            )}
          </div>
          {/* Quick wins removed for now */}
          {/* Input */}
          <div className="mt-2 flex gap-2">
            <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&send()} onPaste={onPaste} className="flex-1 bg-charcoal-800/70 border border-white/10 rounded px-2 py-2 text-sm" placeholder="Refine your idea..." />
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e)=>{ if (e.target.files) addFiles(Array.from(e.target.files)) }} />
            <button onClick={()=>fileRef.current?.click()} className="text-xs px-3 py-2 rounded border border-white/10 bg-white/5 hover:bg-white/10">Upload</button>
            <button onClick={send} className="text-xs px-3 py-2 rounded border border-white/10 bg-ralph-pink/70 hover:bg-ralph-pink">Send</button>
          </div>
      </div>
    </div>
  )
}
