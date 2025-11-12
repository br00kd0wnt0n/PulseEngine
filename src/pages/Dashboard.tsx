import NarrativeOverview from '../components/Dashboard/NarrativeOverview'
// import GuidedCalculator from '../components/Dashboard/GuidedCalculator'
import ProjectPotentialCalculator from '../components/Dashboard/ProjectPotentialCalculator'
import CreatorPanel from '../components/Dashboard/CreatorPanel'
import StoryRecommendations from '../components/Dashboard/StoryRecommendations'
import UnderTheHood from '../components/Dashboard/UnderTheHood'
import StoryPromptHero from '../components/Dashboard/StoryPromptHero'
import AtAGlance from '../components/Dashboard/AtAGlance'
import AtAGlanceV2 from '../components/Dashboard/AtAGlanceV2'
import { useDashboard } from '../context/DashboardContext'
import FloatingUpload from '../components/Floating/FloatingUpload'
import FloatingChat from '../components/Floating/FloatingChat'

export default function Dashboard() {
  const { activated } = useDashboard()

  // Progressive disclosure: show minimal interface initially
  if (!activated) {
    return (
      <div className="animate-in fade-in duration-500">
        <div className="w-full max-w-3xl mx-auto px-4">
          <StoryPromptHero />
        </div>
      </div>
    )
  }

  // Once activated, show the full dashboard with smooth transitions
  return (
    <div className="animate-in fade-in duration-500">
      {/* Current Story then At‑a‑Glance strip */}
      <div className="mb-6"><StoryPromptHero /></div>
      <div className="space-y-6 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150"><AtAGlanceV2 /></div>
      {/* Narrative (left) and Project Potential (right) */}
      <div id="dashboard-main" className="grid lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        <div className="space-y-6">
          <NarrativeOverview />
        </div>
        <div className="space-y-6" id="project-potential">
          <ProjectPotentialCalculator mode="viz" />
        </div>
      </div>
      {/* Creator Intelligence (left) and Story Recommendations (right) */}
      <div className="grid lg:grid-cols-2 gap-6 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
        <div className="space-y-6">
          <CreatorPanel />
          {/* Move Under the Hood under Creative Partner */}
          <UnderTheHood />
        </div>
        <div className="space-y-6">
          <StoryRecommendations />
        </div>
      </div>
      {/* Floating always-available helpers */}
      <FloatingUpload />
      <FloatingChat />
    </div>
  )
}
