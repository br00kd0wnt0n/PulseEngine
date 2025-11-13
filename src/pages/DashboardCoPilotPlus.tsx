import AtAGlanceV2 from '../components/Dashboard/AtAGlanceV2'
import RelevantTrends from '../components/CoPilot/RelevantTrends'
import NarrativeFramework from '../components/CoPilot/NarrativeFramework'
import CoPilotChat from '../components/CoPilot/CoPilotChat'
import StoryRecommendations from '../components/Dashboard/StoryRecommendations'
import NarrativeOverview from '../components/Dashboard/NarrativeOverview'
import CreatorPanel from '../components/Dashboard/CreatorPanel'
import ActivityPanel from '../components/CoPilot/ActivityPanel'
import { useDashboard } from '../context/DashboardContext'
import { usePreferences } from '../context/PreferencesContext'
import { useUpload } from '../context/UploadContext'

export default function DashboardCoPilotPlus() {
  const { concept } = useDashboard()
  const prefs = usePreferences()
  const { processed } = useUpload()
  const tags = Array.from(new Set(processed.flatMap(p => p.tags))).slice(0, 24)
  return (
    <div className="space-y-6">
      {/* Top: Current Story (blue) + Quick Analysis + Relevant Trends */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <div className="panel p-4 bg-ralph-teal/20 border border-ralph-teal/40">
            <div className="text-xs text-white/70 mb-1">Current Story</div>
            <div className="font-semibold truncate" title={concept}>{concept || 'No story yet'}</div>
            <div className="mt-2 text-xs text-white/70">Persona: {prefs.persona} • Focus: {prefs.platforms.join(', ')} • Areas: {prefs.areasOfInterest.join(', ')}</div>
          </div>
          <div className="panel p-3">
            <div className="text-xs text-white/60 mb-1">Context</div>
            <div className="flex flex-wrap gap-2 text-xs">
              {tags.length ? tags.map(t => <span key={t} className="px-2 py-1 rounded bg-white/5 border border-white/10">{t}</span>) : <span className="text-white/50">No context yet</span>}
            </div>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-3">
          <AtAGlanceV2 />
          <RelevantTrends />
        </div>
      </div>

      {/* Narrative Deconstruction */}
      <NarrativeFramework />

      {/* Centralized Co‑Pilot with surrounding modules */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <NarrativeOverview />
        </div>
        <div className="space-y-4">
          <CoPilotChat />
        </div>
        <div className="space-y-4">
          <StoryRecommendations />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><CreatorPanel /></div>
        <div><ActivityPanel /></div>
      </div>
    </div>
  )
}

