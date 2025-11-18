import { NavLink } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { useLayout } from '../../context/LayoutContext'
import LogoMark from '../LogoMark'

const nav = [
  { to: '/', label: 'Project Dashboard' },
  { to: '/creators', label: 'Creators' },
  { to: '/projects', label: 'Projects' },
  { to: '/trends-admin', label: 'Trends' },
  { to: '/admin', label: 'Backend' },
  { to: '/rkb', label: 'RKB' },
]

export default function Sidebar() {
  const { dark } = useTheme()
  const { sidebarOpen, closeSidebar } = useLayout()
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={closeSidebar}
      />
      {/* Drawer */}
      <aside
        className={`fixed z-40 top-0 left-0 h-full w-64 bg-charcoal-800/95 border-r border-white/10 backdrop-blur transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-hidden={!sidebarOpen}
      >
        <div className="flex flex-col gap-4 p-4 h-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-charcoal-700/40 border border-white/5">
              <LogoMark size={28} />
              <div className="leading-tight">
                <div className="font-semibold">Storytelling Intelligence</div>
                <div className="text-white/50 text-[10px]">Navigation</div>
              </div>
            </div>
            <button onClick={closeSidebar} className="text-white/70 text-sm px-2 py-1 border border-white/10 rounded-md hover:bg-white/10">✕</button>
          </div>

          <nav className="flex-1 space-y-1 overflow-auto">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm border border-transparent hover:border-white/5 hover:bg-charcoal-700/30 ${
                    isActive ? 'bg-charcoal-700/50 border-white/10 text-white' : 'text-white/70'
                  }`
                }
                end={n.to === '/'}
                onClick={closeSidebar}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-white/10 pt-3">
            <button
              onClick={() => {
                // Get projectId BEFORE clearing it
                const activeProjectId = localStorage.getItem('activeProjectId') || 'local'

                // Clear all project-specific data
                const projectKeys = [
                  `conv:${activeProjectId}`,
                  `debrief:${activeProjectId}`,
                  `opps:${activeProjectId}`,
                  `nf:${activeProjectId}`,
                  `score:${activeProjectId}`,
                  `progressive:stage:${activeProjectId}`,
                  `narrative:visible:${activeProjectId}`,
                ]
                projectKeys.forEach(key => {
                  try { localStorage.removeItem(key) } catch {}
                })

                // Clear global project settings
                const globalKeys = ['activeProjectId', 'concept', 'persona', 'region']
                globalKeys.forEach(key => {
                  try { localStorage.removeItem(key) } catch {}
                })

                closeSidebar()
                // Navigate to home/landing
                window.location.href = '/'
              }}
              className="w-full px-3 py-2 text-sm rounded-md border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
            >
              Start Over
            </button>
          </div>

          <div className="mt-2 text-[10px] text-white/40">Dark Mode {dark ? 'On' : 'Off'}</div>
        </div>
      </aside>
    </>
  )
}
