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
      {/* Full-width primary insight modules for strong hierarchy */}
      <div className="space-y-6 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
        <NarrativeOverview />
        <AtAGlanceV2 />
      </div>
      {/* Two-column insight/workflow modules */}
      <div id="dashboard-main" className="grid xl:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
        <div className="space-y-6">
          <GuidedCalculator />
          <TrendEcosystem />
        </div>
        <div className="space-y-6">
          <ContentIngest />
          <CreatorPanel />
        </div>
      </div>
    </div>
  )
}
