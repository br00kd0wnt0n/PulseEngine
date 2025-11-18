import { useEffect, useState } from 'react'
import { useCitations, CitationProvider } from '../../context/CitationContext'

type Citation = { id: string; label: string; detail: string }

export default function CitationOverlay() {
  const { citations } = useCitations()
  const [open, setOpen] = useState(false)
  const [cit, setCit] = useState<Citation | null>(null)
  const [showAll, setShowAll] = useState(false)
  useEffect(() => {
    function onOpen(e: any) {
      const d = e?.detail || {}
      if (String(d.id) === 'all') {
        setShowAll(true); setCit(null); setOpen(true)
      } else {
        setShowAll(false)
        setCit({ id: d.id || '1', label: d.label || 'Citation', detail: d.detail || '' })
        setOpen(true)
      }
    }
    window.addEventListener('open-citation' as any, onOpen as any)
    return () => window.removeEventListener('open-citation' as any, onOpen as any)
  }, [])
  if (!open || (!cit && !showAll)) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="panel p-4 max-w-lg w-full">
        {!showAll && cit && (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-ralph-pink">[{cit.id}] {cit.label}</div>
              <button className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setOpen(false)}>Close</button>
            </div>
            <div className="text-sm text-white/80 whitespace-pre-wrap">
              {cit.detail || 'Source details unavailable.'}
            </div>
          </>
        )}
        {showAll && (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-ralph-pink">Citations</div>
              <button className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setOpen(false)}>Close</button>
            </div>
            <div className="space-y-2 text-sm text-white/80">
              {citations.length === 0 && <div>No citations available.</div>}
              {citations.map(c => (
                <div key={c.id} className="panel p-2">
                  <div className="font-medium text-ralph-pink">[{c.id}] {c.label}</div>
                  <div className="mt-1 text-white/70 whitespace-pre-wrap">{c.detail}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function CitationToken({ id, label, detail }: { id: number; label: string; detail: string }) {
  return (
    <button
      onClick={() => {
        try { window.dispatchEvent(new CustomEvent('open-citation', { detail: { id, label, detail } })) } catch {}
      }}
      className="inline-flex items-center justify-center align-middle text-[10px] px-1.5 py-0.5 rounded border border-ralph-pink/50 bg-ralph-pink/10 text-ralph-pink hover:bg-ralph-pink/30 hover:border-ralph-pink hover:scale-110 transition-all cursor-pointer underline decoration-dotted shadow-sm hover:shadow-ralph-pink/20"
      title={`Click to view: ${label}`}
    >
      [{id}]
    </button>
  )
}

// Allow registering citations from non-React contexts via window helper
declare global { interface Window { __registerCitation?: (label: string, detail: string) => number } }

import { createRoot } from 'react-dom/client'
import React from 'react'

// Attach a helper to register citations using the current context (consumed via a hidden portal)
// This is a minimal bridge; in-app usage should prefer the hook directly.
function CitationBridge() {
  const { register } = useCitations()
  // Expose a stable function
  window.__registerCitation = (label: string, detail: string) => register(label, detail)
  return null
}

// Mount a hidden citation bridge once
if (typeof window !== 'undefined' && !document.getElementById('citation-bridge')) {
  const el = document.createElement('div'); el.id = 'citation-bridge'; el.style.display = 'none'; document.body.appendChild(el)
  const root = createRoot(el)
  root.render(
    <React.StrictMode>
      <CitationProvider>
        <CitationBridge />
      </CitationProvider>
    </React.StrictMode>
  )
}
