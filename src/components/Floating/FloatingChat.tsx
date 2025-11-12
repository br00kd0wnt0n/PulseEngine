import { useEffect, useMemo, useRef, useState } from 'react'
// local storage MVP chat; API stubs are left for later integration
import { logActivity } from '../../utils/activity'
import { useDashboard } from '../../context/DashboardContext'

export default function FloatingChat({ projectId }: { projectId?: string }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement|null>(null)
  const { keyDrivers } = useDashboard()

  const activeProjectId = useMemo(() => {
    try { return projectId || localStorage.getItem('activeProjectId') || 'local' } catch { return projectId || 'local' }
  }, [projectId])

  useEffect(() => {
    if (!open) return
    const key = `conv:${activeProjectId}`
    try { const arr = JSON.parse(localStorage.getItem(key) || '[]'); setItems(arr) } catch {}
  }, [open, activeProjectId])

  async function send() {
    if (!text.trim()) return
    setText('')
    const key = `conv:${activeProjectId}`
    const msg = { id: 'local-'+Date.now(), role: 'user', content: text.trim(), createdAt: new Date().toISOString() }
    setItems((it) => {
      const next = [...it, msg]
      try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
      return next
    })
    try { window.dispatchEvent(new CustomEvent('conversation-updated')) } catch {}
    try { logActivity('User message posted; updating recommendations') } catch {}
  }

  // Open panel on global event
  useEffect(() => {
    function handler() { setOpen(true) }
    window.addEventListener('open-chat', handler as any)
    return () => window.removeEventListener('open-chat', handler as any)
  }, [])

  return (
    <div className="fixed bottom-4 right-36 z-40">
      {!open && (
        <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-full text-xs bg-white/10 hover:bg-white/15 border border-white/20 shadow-md">
          + Refine Story
        </button>
      )}
      {open && (
        <div className="w-[360px] panel p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Conversation</div>
            <button onClick={() => setOpen(false)} className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10">Close</button>
          </div>
          <div className="h-40 overflow-auto space-y-2 text-sm">
            {items.map((m, i) => (
              <div key={m.id || i} className={`p-2 rounded ${m.role === 'user' ? 'bg-white/5' : 'bg-ralph-purple/10'}`}>{m.content}</div>
            ))}
          </div>
          <div className="mt-2">
            <div className="text-[11px] text-white/60 mb-1">Quick wins</div>
            <div className="flex flex-wrap gap-2">
              {buildQuickWins(keyDrivers).map((q, i) => (
                <button key={i} onClick={() => { setText(q); inputRef.current?.focus() }} className="text-[11px] px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10">
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key==='Enter' && send()} className="flex-1 bg-charcoal-800/70 border border-white/10 rounded px-2 py-1 text-sm" placeholder="Refine your idea..." />
            <button onClick={send} className="text-xs px-3 py-1.5 rounded border border-white/10 bg-ralph-pink/70 hover:bg-ralph-pink">Send</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Listen for global event to open chat
if (typeof window !== 'undefined') {
  window.addEventListener('open-chat', () => {
    // no-op placeholder; component instance handles via effect
  })
}

function buildQuickWins(keyDrivers?: string[] | null): string[] {
  const base = [
    'Tighten the opening hook to 7–10 words',
    'Add a duet/stitch prompt and CTA',
    'Propose a loopable 7–10s beat',
  ]
  const kd = (keyDrivers || []).slice(0, 2)
  const kdWins = kd.map(k => `Emphasize ${k} in the first line`)
  return [...kdWins, ...base].slice(0, 5)
}
