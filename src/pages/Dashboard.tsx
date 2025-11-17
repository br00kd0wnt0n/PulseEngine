import { useEffect } from 'react'
import NarrativeOverview from '../components/Dashboard/NarrativeOverview'
import ProjectPotentialCalculator from '../components/Dashboard/ProjectPotentialCalculator'
import CreatorPanel from '../components/Dashboard/CreatorPanel'
import StoryRecommendations from '../components/Dashboard/StoryRecommendations'
import UnderTheHood from '../components/Dashboard/UnderTheHood'
import StoryPromptHero from '../components/Dashboard/StoryPromptHero'
import AtAGlanceV2 from '../components/Dashboard/AtAGlanceV2'
import { useDashboard } from '../context/DashboardContext'
import CoPilotChat from '../components/CoPilot/CoPilotChat'
import ActivityPanel from '../components/CoPilot/ActivityPanel'

export default function Dashboard() {
  const { activated, persona } = useDashboard() as any

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
      {/* Persona-aware nudge to guide next steps */}
      <PersonaNudge persona={persona} active={activated} />
      {/* Current Story then At‑a‑Glance strip */}
      <div className="mb-3"><StoryPromptHero /></div>
      {/* Top breadcrumb-style stages */}
      <div className="mb-6">
        <div className="panel p-3 text-xs text-white/70">
          <span>Brief</span>
          <span className="mx-2 text-white/40">&gt;</span>
          <span>Narrative Foundation</span>
          <span className="mx-2 text-white/40">&gt;</span>
          <span>Strategic Refinement</span>
          <span className="mx-2 text-white/40">&gt;</span>
          <span>Concept Proposal</span>
        </div>
      </div>
      <div className="space-y-6 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150"><AtAGlanceV2 /></div>
      {/* Main + Side Co‑Pilot */}
      <div className="grid lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        <div className="lg:col-span-2 space-y-6">
          <div id="dashboard-main" className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <NarrativeOverview />
            </div>
            <div className="space-y-6" id="project-potential">
              <ProjectPotentialCalculator mode="viz" />
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-6 mt-6">
            <div className="space-y-6">
              <CreatorPanel />
              <UnderTheHood />
            </div>
            <div className="space-y-6">
              <StoryRecommendations />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="sticky top-20 space-y-4">
            <CoPilotChat />
            <ActivityPanel />
          </div>
        </div>
      </div>
    </div>
  )
}

function PersonaNudge({ persona, active }: { persona: string; active: boolean }) {
  useEffect(() => {
    if (!active) return
    const p = (persona || '').toLowerCase()
    let msg = ''
    if (p.includes('content')) {
      msg = `As a Content Creator, let's map trims for TikTok/Shorts/Reels and pick thumbnails. Tell me your preference and I’ll adapt the plan.`
    } else if (p.includes('creative')) {
      msg = `As a Creative Lead, let's sharpen the hook and the pivotal reveal beat. I can propose 2–3 options if you like.`
    } else {
      msg = `As a Social Strategist, let's define KPIs and the leading indicators you want to move. Share targets and I’ll tune recommendations.`
    }
    try {
      window.dispatchEvent(new CustomEvent('open-chat'))
      window.dispatchEvent(new CustomEvent('copilot-say', { detail: { text: msg } }))
    } catch {}
  }, [active, persona])
  return null
}
