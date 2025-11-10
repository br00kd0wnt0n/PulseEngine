import { Outlet } from 'react-router-dom'
import Sidebar from './components/Layout/Sidebar'
import Topbar from './components/Layout/Topbar'

export default function App() {
  return (
    <div className="min-h-screen bg-charcoal-900 bg-grid-charcoal bg-grid-24">
      {/* Sidebar is now an overlay/drawer and does not affect layout width */}
      <Sidebar />
      <div className="flex flex-col min-h-screen">
        <Topbar />
        <main className="p-6 md:p-8 space-y-6">
          <Outlet />
        </main>
        <footer className="px-6 md:px-8 py-4 text-xs text-white/40 border-t border-white/5">
          Pulse · Storytelling Intelligence · Prototype
        </footer>
      </div>
    </div>
  )
}
