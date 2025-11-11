import { useEffect, useMemo, useState } from 'react'
import { useTrends } from '../../context/TrendContext'
import { generateNarrative } from '../../services/ai'
import { api } from '../../services/api'
import Tooltip from '../shared/Tooltip'

export default function NarrativeOverview() {
  const { snapshot } = useTrends()
  const [text, setText] = useState('')

  useEffect(() => {
    // Try backend OpenAI narrative first; fallback to local mock
    api.narrative(snapshot(), null)
      .then((r) => setText(r.text))
      .catch(() => generateNarrative(snapshot(), null).then(setText))
  }, [snapshot])

  const [expanded, setExpanded] = useState(false)
  const trends = useMemo(() => snapshot().nodes.filter(n => n.kind === 'trend'), [snapshot])
  const visible = expanded ? trends : trends.slice(0, 8)

  // Mock data for snapshot date/time
  const snapshotDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
  const timeRange = 'Last 7 days'

  // Mock deeper data for each vector
  const getVectorDetails = (trend: any) => {
    const platformFit = 60 + (trend.id.charCodeAt(0) % 35)
    return {
      platforms: ['TikTok', 'Instagram', 'YouTube Shorts'],
      engagement: `${platformFit}% avg engagement`,
      velocity: `Rising +${Math.floor(platformFit / 10)}% daily`,
      audience: 'Gen Z, 18-24',
      bestTime: 'Peak: 6-9PM EST'
    }
  }

  return (
    <div className="panel module p-4 transform-gpu">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Narrative Potential Overview</div>
        <div className="flex items-center gap-2">
          {/* Snapshot date pill */}
          <div className="px-3 py-1 bg-ralph-purple/20 border border-ralph-purple/30 rounded-full text-xs text-ralph-purple font-medium">
            📅 {snapshotDate}
          </div>
          {/* Time range pill */}
          <div className="px-3 py-1 bg-ralph-teal/20 border border-ralph-teal/30 rounded-full text-xs text-ralph-cyan font-medium">
            ⏱️ {timeRange}
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 text-sm leading-relaxed whitespace-pre-wrap min-h-[140px]">
          {text || 'Generating narrative...'}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/60 flex items-center">Cross-platform Vectors<Tooltip label="Vectors"><span>Top trends relevant to your story; bar shows platform fit. Click ? to view quick details.
            </span></Tooltip></div>
            {trends.length > 8 && (
              <button className="text-[11px] px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setExpanded(e => !e)}>{expanded ? 'Show less' : 'Show more'}</button>
            )}
          </div>
          {visible.map(t => {
            const details = getVectorDetails(t)
            const platformFit = 60 + (t.id.charCodeAt(0) % 35)

            return (
              <div key={t.id} className="flex items-start gap-2">
                <div className="flex-1 text-xs cursor-help transition-all hover:bg-white/5 hover:border-ralph-pink/30 rounded-lg p-2 border border-transparent">
                  <div className="flex items-center justify-between">
                    <span className="text-white/80 font-medium">{t.label}</span>
                    <span className="text-white/50 text-[10px]">platform fit</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full bg-charcoal-700/50 rounded overflow-hidden">
                    <div
                      className="h-2 rounded accent-gradient transition-all duration-300"
                      style={{ width: `${platformFit}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-white/40 text-right">{platformFit}%</div>
                </div>
                <Tooltip label={t.label}>
                  <div className="space-y-2">
                    <div className="font-semibold text-sm text-white border-b border-white/10 pb-2">
                      {t.label}
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div>
                        <div className="text-white/50 mb-1">Platforms</div>
                        <div className="flex flex-wrap gap-1">
                          {details.platforms.map(p => (
                            <span key={p} className="px-2 py-0.5 bg-white/10 rounded text-white/80">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-white/50">Engagement</div>
                        <div className="text-ralph-cyan">{details.engagement}</div>
                      </div>
                      <div>
                        <div className="text-white/50">Velocity</div>
                        <div className="text-ralph-pink">{details.velocity}</div>
                      </div>
                      <div>
                        <div className="text-white/50">Primary Audience</div>
                        <div className="text-white/80">{details.audience}</div>
                      </div>
                      <div>
                        <div className="text-white/50">Best Posting Time</div>
                        <div className="text-white/80">{details.bestTime}</div>
                      </div>
                    </div>
                  </div>
                </Tooltip>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
