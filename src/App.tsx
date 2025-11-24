import { Outlet } from 'react-router-dom'
import Sidebar from './components/Layout/Sidebar'
import Topbar from './components/Layout/Topbar'
import CitationOverlay from './components/shared/CitationOverlay'
import { CitationProvider } from './context/CitationContext'
import pkg from '../package.json'
import { useEffect, useState } from 'react'
import { api } from './services/api'

export default function App() {
  const [apiVersion, setApiVersion] = useState<string | null>(null)
  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const v = await api.statusVersion()
        if (!cancel) {
          const ver = [v?.version, v?.git?.sha ? String(v.git.sha).slice(0,7) : null].filter(Boolean).join(' ')
          setApiVersion(ver || null)
        }
      } catch {
        if (!cancel) setApiVersion(null)
      }
    })()
    return () => { cancel = true }
  }, [])
  return (
    <div className="min-h-screen bg-charcoal-900 bg-grid-charcoal bg-grid-24">
      {/* Sidebar is now an overlay/drawer and does not affect layout width */}
      <Sidebar />
      <div className="flex flex-col min-h-screen">
        <Topbar />
        <CitationProvider>
          <main className="p-6 md:p-8 space-y-6">
            <Outlet />
          </main>
          <CitationOverlay />
        </CitationProvider>
        <footer className="px-6 md:px-8 py-4 text-xs text-white/40 border-t border-white/5 text-center">
          Ralph 2025 · Storytelling Intelligence · Prototype · Vers {apiVersion || pkg.version || '0.0.0'}
        </footer>
      </div>
    </div>
  )
}
