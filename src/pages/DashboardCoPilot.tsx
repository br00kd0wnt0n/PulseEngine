import AtAGlanceV2 from '../components/Dashboard/AtAGlanceV2'
import CoPilotChat from '../components/CoPilot/CoPilotChat'
import NarrativeOverview from '../components/Dashboard/NarrativeOverview'
import CreatorPanel from '../components/Dashboard/CreatorPanel'
import StoryRecommendations from '../components/Dashboard/StoryRecommendations'
import { useDashboard } from '../context/DashboardContext'
import { usePreferences } from '../context/PreferencesContext'
import { useUpload } from '../context/UploadContext'

export default function DashboardCoPilot() {
  const { concept } = useDashboard()
  const prefs = usePreferences()
  const { processed } = useUpload()
  const tags = Array.from(new Set(processed.flatMap(p => p.tags))).slice(0, 24)
  return (
    <div className="space-y-6">
      {/* Top Section: Current Story (condensed) + Quick Analysis + Context tags */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="panel p-4">
          <div className="text-xs text-white/60 mb-1">Current Story</div>
          <div className="font-semibold truncate" title={concept}>{concept || 'No story yet'}</div>
          <div className="mt-2 text-xs text-white/60">Persona: {prefs.persona} • Focus: {prefs.platforms.join(', ')} • Areas: {prefs.areasOfInterest.join(', ')}</div>
        </div>
        <div className="lg:col-span-2"><AtAGlanceV2 /></div>
      </div>

      <div className="panel p-3">
        <div className="text-xs text-white/60 mb-2">Context</div>
        <div className="flex flex-wrap gap-2 text-xs">
          {tags.length ? tags.map(t => <span key={t} className="px-2 py-1 rounded bg-white/5 border border-white/10">{t}</span>) : <span className="text-white/50">No context yet — upload files or paste links in the chat below.</span>}
        </div>
      </div>

      {/* Central Co‑Pilot */}
      <CoPilotChat />

      {/* Reactive modules: condensed cards with toggleable detail (reuse existing components) */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <CondensedCard title="Narrative Potential"><NarrativeOverview /></CondensedCard>
        </div>
        <div className="space-y-4">
          <CondensedCard title="Creator Intelligence"><CreatorPanel /></CondensedCard>
        </div>
        <div className="space-y-4">
          <CondensedCard title="Enhancements"><StoryRecommendations /></CondensedCard>
        </div>
      </div>
    </div>
  )
}

function CondensedCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel module p-3">
      <div className="text-xs text-white/60 mb-2">{title}</div>
      <div className="max-h-[520px] overflow-hidden hover:overflow-auto transition-all">
        {children}
      </div>
    </div>
  )
}

