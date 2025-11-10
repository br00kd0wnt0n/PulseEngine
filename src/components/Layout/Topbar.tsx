import { useTheme } from '../../context/ThemeContext'
import { Link } from 'react-router-dom'
import { useLayout } from '../../context/LayoutContext'
import LogoMark from '../LogoMark'

export default function Topbar() {
  const { dark, toggle } = useTheme()
  const { toggleSidebar } = useLayout()
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
      <div className="bg-gradient-to-r from-ralph-pink to-ralph-teal">
        <div className="px-4 md:px-8 py-3 flex items-center gap-3 text-white">
          <button onClick={toggleSidebar} className="px-2 py-1 rounded-md border border-white/20 bg-white/10 hover:bg-white/15" aria-label="Navigation">
            ☰
          </button>
          <Link to="/" className="flex items-center gap-3">
            <LogoMark size={32} className="shadow-[var(--glow-pink)]" />
            <div className="hidden sm:block font-semibold tracking-wide uppercase text-xs">Pulse · Storytelling Intelligence</div>
          </Link>
          <div className="relative flex-1 max-w-2xl ml-auto">
            <input
              className="w-full bg-black/20 border border-white/20 text-white placeholder-white/70 rounded-lg py-2.5 pl-10 pr-3 text-sm focus-visible:shadow-glow"
              placeholder="Search trends, creators, content..."
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/80">⌘K</div>
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
