import NarrativeOverview from '../components/Dashboard/NarrativeOverview'
import GuidedCalculator from '../components/Dashboard/GuidedCalculator'
import CreatorPanel from '../components/Dashboard/CreatorPanel'
import TrendEcosystem from '../components/Dashboard/TrendEcosystem'
import ContentIngest from '../components/Dashboard/ContentIngest'
import StoryPromptHero from '../components/Dashboard/StoryPromptHero'
import AtAGlance from '../components/Dashboard/AtAGlance'
import AtAGlanceV2 from '../components/Dashboard/AtAGlanceV2'
import { useDashboard } from '../context/DashboardContext'

export default function Dashboard() {
  const { activated } = useDashboard()

  // Progressive disclosure: show minimal interface initially
  if (!activated) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="w-full max-w-3xl mx-auto px-4">
          <StoryPromptHero />
        </div>
      </div>
    )
  }

  // Once activated, show the full dashboard with smooth transitions
  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6"><StoryPromptHero /></div>
      {/* At‑a‑Glance strip at the very top */}
      <div className="space-y-6 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
        <AtAGlanceV2 />
      </div>
      {/* Narrative (left) and Trend Ecosystem (right, expanded) */}
      <div id="dashboard-main" className="grid xl:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        <div className="space-y-6">
          <NarrativeOverview />
        </div>
        <div className="space-y-6">
          <TrendEcosystem defaultOpen={true} />
        </div>
      </div>
      {/* Guided calculator as a full-width section to anchor CTA */}
      <div id="calc" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-250">
        <GuidedCalculator />
      </div>
      {/* Creator Intelligence (left) and Content Upload (right) */}
      <div className="grid xl:grid-cols-2 gap-6 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
        <div className="space-y-6">
          <CreatorPanel />
        </div>
        <div className="space-y-6">
          <ContentIngest />
        </div>
      </div>
    </div>
  )
}
