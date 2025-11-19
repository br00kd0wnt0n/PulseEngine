import { useState, useEffect } from 'react'
import Canvas from '../components/Canvas/Canvas'
import { NodeData } from '../components/Canvas/Node'
import FloatingAssistant from '../components/Canvas/FloatingAssistant'
import { useDashboard } from '../context/DashboardContext'
import { useUpload } from '../context/UploadContext'

export default function CanvasWorkflow() {
  const { concept, setConcept, activated, setActivated, persona, setPersona, region, setRegion } = useDashboard() as any
  const { addFiles, addUrl, processed } = useUpload()
  const [nodes, setNodes] = useState<NodeData[]>([])

  // Initialize nodes with smart auto-layout
  useEffect(() => {
    const initialNodes: NodeData[] = [
      {
        id: 'brief-input',
        type: 'input',
        title: 'Story Brief',
        x: 50,
        y: 100,
        width: 400,
        height: 280,
        minimized: false,
        zIndex: 1,
        status: 'active'
      },
      {
        id: 'context-upload',
        type: 'upload',
        title: 'Context & Files',
        x: 50,
        y: 400,
        width: 400,
        height: 180,
        minimized: false,
        zIndex: 1,
        status: 'idle',
        connectedTo: ['brief-input']
      }
    ]

    setNodes(initialNodes)
  }, [])

  // Step 1: Add RKB and Debrief/Opportunities when workflow starts
  useEffect(() => {
    if (activated && !nodes.find(n => n.id === 'rkb')) {
      setNodes(prev => [
        ...prev,
        // RKB node (AI-content, orange)
        {
          id: 'rkb',
          type: 'rkb',
          title: 'Ralph Knowledge Base',
          x: 50,
          y: 620,
          width: 300,
          height: 150,
          minimized: false,
          zIndex: 2,
          status: 'idle'
        },
        // Debrief & Opportunities node (AI-content, orange)
        {
          id: 'debrief-opportunities',
          type: 'ai-content',
          title: 'Debrief & Opportunities',
          x: 500,
          y: 100,
          width: 450,
          height: 500,
          minimized: false,
          zIndex: 2,
          status: 'processing',
          connectedTo: ['brief-input', 'context-upload', 'rkb']
        }
      ])
    }
  }, [activated, nodes])

  // Step 2: Add Narrative Structure after user accepts opportunities (simulated after 5 seconds)
  useEffect(() => {
    if (!nodes.find(n => n.id === 'debrief-opportunities')) return

    const debriefNode = nodes.find(n => n.id === 'debrief-opportunities')
    if (debriefNode?.status === 'processing' && !nodes.find(n => n.id === 'narrative')) {
      const timer = setTimeout(() => {
        // Mark debrief as complete
        setNodes(prev => prev.map(n =>
          n.id === 'debrief-opportunities' ? { ...n, status: 'complete' as const } : n
        ))

        setTimeout(() => {
          setNodes(prev => [
            ...prev,
            // Narrative Structure node
            {
              id: 'narrative',
              type: 'ai-content',
              title: 'Narrative Structure',
              x: 1000,
              y: 100,
              width: 450,
              height: 450,
              minimized: false,
              zIndex: 3,
              status: 'processing',
              connectedTo: ['debrief-opportunities']
            }
          ])
        }, 500)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [nodes])

  // Step 3: Add Scoring & Enhancements after narrative is reviewed (simulated after 5 seconds)
  useEffect(() => {
    if (!nodes.find(n => n.id === 'narrative')) return

    const narrativeNode = nodes.find(n => n.id === 'narrative')
    if (narrativeNode?.status === 'processing' && !nodes.find(n => n.id === 'scoring')) {
      const timer = setTimeout(() => {
        // Mark narrative as complete
        setNodes(prev => prev.map(n =>
          n.id === 'narrative' ? { ...n, status: 'complete' as const } : n
        ))

        setTimeout(() => {
          setNodes(prev => [
            ...prev,
            // Scoring & Enhancements node
            {
              id: 'scoring',
              type: 'ai-content',
              title: 'Scoring & Enhancements',
              x: 1500,
              y: 100,
              width: 450,
              height: 550,
              minimized: false,
              zIndex: 4,
              status: 'processing',
              connectedTo: ['narrative', 'rkb']
            }
          ])
        }, 500)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [nodes])

  // Step 4: Add Creative Partner node after enhancements selected (simulated after 5 seconds)
  useEffect(() => {
    if (!nodes.find(n => n.id === 'scoring')) return

    const scoringNode = nodes.find(n => n.id === 'scoring')
    if (scoringNode?.status === 'processing' && !nodes.find(n => n.id === 'creative-partner')) {
      const timer = setTimeout(() => {
        // Mark scoring as complete
        setNodes(prev => prev.map(n =>
          n.id === 'scoring' ? { ...n, status: 'complete' as const } : n
        ))

        setTimeout(() => {
          setNodes(prev => [
            ...prev,
            // Creative Partner node
            {
              id: 'creative-partner',
              type: 'ai-content',
              title: 'Need a Creative Partner?',
              x: 2000,
              y: 100,
              width: 400,
              height: 500,
              minimized: false,
              zIndex: 5,
              status: 'active',
              connectedTo: ['scoring']
            }
          ])
        }, 500)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [nodes])

  const handleSubmit = () => {
    if (!concept) return
    setActivated(true)
    // Nodes keep their colors, no minimizing - workflow stays visible
  }

  const renderNodeContent = (node: NodeData) => {
    if (node.id === 'brief-input') {
      return (
        <div className="space-y-2">
          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Describe your campaign story..."
            className="w-full h-24 bg-charcoal-800/70 border border-white/10 rounded px-3 py-2 text-sm resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              className="bg-charcoal-800/70 border border-white/10 rounded px-2 py-1 text-xs"
            >
              <option value="">Select Persona</option>
              <option value="Social strategist">Social strategist</option>
              <option value="Creative Lead">Creative Lead</option>
              <option value="Content Creator">Content Creator</option>
            </select>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              className="bg-charcoal-800/70 border border-white/10 rounded px-2 py-1 text-xs"
            >
              <option value="">Select Region</option>
              <option value="Worldwide">Worldwide</option>
              <option value="US">US</option>
              <option value="EU">EU</option>
              <option value="North America">North America</option>
              <option value="Europe">Europe</option>
              <option value="Asia Pacific">Asia Pacific</option>
            </select>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={!concept}
            className="w-full px-3 py-2 rounded bg-ralph-cyan/70 hover:bg-ralph-cyan text-sm font-medium disabled:opacity-50"
          >
            Analyze Story
          </button>
        </div>
      )
    }

    if (node.id === 'context-upload') {
      return (
        <div className="space-y-2">
          <div className="text-xs text-white/60 mb-1">
            {processed.length} files uploaded
          </div>
          <div className="flex flex-wrap gap-1 mb-2 max-h-16 overflow-auto">
            {processed.slice(0, 5).map((p, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-white/10 text-[10px] border border-white/10">
                {p.name}
              </span>
            ))}
          </div>
          <input
            type="file"
            multiple
            onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
            className="hidden"
            id="canvas-file-upload"
          />
          <label
            htmlFor="canvas-file-upload"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="block w-full px-3 py-2 rounded border border-dashed border-white/20 hover:border-ralph-cyan/40 text-xs text-center cursor-pointer transition-colors"
          >
            + Add Context Files
          </label>
        </div>
      )
    }

    if (node.id === 'rkb') {
      return (
        <div className="space-y-2 text-xs">
          <div className="text-white/70 leading-relaxed text-[11px]">
            Ralph Knowledge Base connected
          </div>
          <div className="text-white/50 text-[10px]">
            186 assets • Cultural insights • Trend data
          </div>
        </div>
      )
    }

    if (node.id === 'debrief-opportunities') {
      return (
        <div className="space-y-3 text-xs max-h-full overflow-auto">
          {node.status === 'processing' ? (
            <div className="text-white/80 leading-relaxed">
              AI is analyzing your campaign with RKB semantic search...
            </div>
          ) : (
            <>
              <div className="panel p-2 bg-white/5">
                <div className="text-white/70 font-medium mb-1 text-[11px]">DEBRIEF</div>
                <div className="text-white/60 text-[10px] leading-relaxed">
                  Strong cultural relevance detected. Campaign aligns with current music trends and has high engagement potential across TikTok and Instagram.
                </div>
              </div>

              <div className="panel p-2 bg-white/5">
                <div className="text-white/70 font-medium mb-1 text-[11px]">OPPORTUNITIES</div>
                <div className="space-y-2 mt-2">
                  <label className="flex items-start gap-2 cursor-pointer group">
                    <input type="checkbox" className="mt-0.5" />
                    <span className="text-white/70 text-[10px] group-hover:text-white/90">
                      TikTok-first approach with Instagram Reels crossover
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer group">
                    <input type="checkbox" className="mt-0.5" />
                    <span className="text-white/70 text-[10px] group-hover:text-white/90">
                      Partner with 3 micro-influencers + 1 mid-tier creator
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer group">
                    <input type="checkbox" className="mt-0.5" />
                    <span className="text-white/70 text-[10px] group-hover:text-white/90">
                      Content mix: 60% native, 30% UGC, 10% branded
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer group">
                    <input type="checkbox" className="mt-0.5" />
                    <span className="text-white/70 text-[10px] group-hover:text-white/90">
                      Launch timing: Q4 2024 for maximum impact
                    </span>
                  </label>
                </div>
              </div>

              <button
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 rounded bg-ralph-cyan/70 hover:bg-ralph-cyan text-xs font-medium"
              >
                Accept & Continue
              </button>
            </>
          )}
        </div>
      )
    }

    if (node.id === 'narrative') {
      return (
        <div className="space-y-3 text-xs max-h-full overflow-auto">
          {node.status === 'processing' ? (
            <div className="text-white/80 leading-relaxed">
              Composing end-to-end narrative structure...
            </div>
          ) : (
            <>
              <div className="panel p-2 bg-white/5">
                <div className="text-white/70 font-medium mb-2 text-[11px]">CAMPAIGN OVERVIEW</div>
                <div className="text-white/60 text-[10px] leading-relaxed mb-3">
                  A TikTok-first music discovery campaign that leverages algorithmic trends and micro-influencer authenticity to drive organic engagement across Gen Z audiences.
                </div>
              </div>

              <div className="panel p-2 bg-white/5">
                <div className="text-white/70 font-medium mb-1 text-[11px]">NARRATIVE ARC</div>
                <div className="space-y-1.5 text-[10px] text-white/60">
                  <div><span className="text-ralph-cyan">Phase 1:</span> Discovery (Weeks 1-2)</div>
                  <div><span className="text-ralph-cyan">Phase 2:</span> Amplification (Weeks 3-4)</div>
                  <div><span className="text-ralph-cyan">Phase 3:</span> Conversion (Weeks 5-6)</div>
                </div>
              </div>

              <div className="panel p-2 bg-white/5">
                <div className="text-white/70 font-medium mb-1 text-[11px]">KEY TOUCHPOINTS</div>
                <ul className="space-y-1 text-white/60 text-[10px]">
                  <li>• Influencer seed content on TikTok</li>
                  <li>• Cross-platform amplification</li>
                  <li>• UGC activation & hashtag challenge</li>
                  <li>• Conversion funnel optimization</li>
                </ul>
              </div>

              <button
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 rounded bg-ralph-cyan/70 hover:bg-ralph-cyan text-xs font-medium"
              >
                Approve Narrative
              </button>
            </>
          )}
        </div>
      )
    }

    if (node.id === 'scoring') {
      return (
        <div className="space-y-3 text-xs max-h-full overflow-auto">
          {node.status === 'processing' ? (
            <div className="text-white/80 leading-relaxed">
              Calculating metrics and analyzing enhancements...
            </div>
          ) : (
            <>
              <div className="panel p-2 bg-white/5">
                <div className="text-white/70 font-medium mb-2 text-[11px]">CAMPAIGN SCORING</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-[10px]">Cultural Relevance</span>
                    <span className="text-ralph-cyan text-[11px] font-medium">8.7/10</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-[10px]">Engagement Potential</span>
                    <span className="text-ralph-cyan text-[11px] font-medium">9.2/10</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-[10px]">Platform Fit</span>
                    <span className="text-ralph-cyan text-[11px] font-medium">8.9/10</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-[10px]">ROI Projection</span>
                    <span className="text-ralph-cyan text-[11px] font-medium">7.8/10</span>
                  </div>
                </div>
              </div>

              <div className="panel p-2 bg-white/5">
                <div className="text-white/70 font-medium mb-2 text-[11px]">RECOMMENDED ENHANCEMENTS</div>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer group">
                    <input type="checkbox" className="mt-0.5" defaultChecked />
                    <div>
                      <div className="text-white/70 text-[10px] group-hover:text-white/90">
                        Add YouTube Shorts component
                      </div>
                      <div className="text-white/50 text-[9px]">+1.2 reach score</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer group">
                    <input type="checkbox" className="mt-0.5" />
                    <div>
                      <div className="text-white/70 text-[10px] group-hover:text-white/90">
                        Integrate trending audio library
                      </div>
                      <div className="text-white/50 text-[9px]">+0.8 cultural relevance</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer group">
                    <input type="checkbox" className="mt-0.5" />
                    <div>
                      <div className="text-white/70 text-[10px] group-hover:text-white/90">
                        Extend to Snapchat Spotlight
                      </div>
                      <div className="text-white/50 text-[9px]">+0.6 platform diversity</div>
                    </div>
                  </label>
                </div>
              </div>

              <button
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 rounded bg-ralph-cyan/70 hover:bg-ralph-cyan text-xs font-medium"
              >
                Apply Enhancements
              </button>
            </>
          )}
        </div>
      )
    }

    if (node.id === 'creative-partner') {
      return (
        <div className="space-y-3 text-xs max-h-full overflow-auto">
          <div className="text-white/80 leading-relaxed mb-2">
            Based on your campaign, here are recommended creators:
          </div>

          <div className="space-y-2">
            <div className="panel p-2 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-ralph-pink/20 border border-ralph-pink/40" />
                <div>
                  <div className="text-white/80 text-[11px] font-medium">@musicdiscovery</div>
                  <div className="text-white/50 text-[9px]">1.2M followers • Music curator</div>
                </div>
              </div>
              <div className="text-white/60 text-[10px]">
                Specializes in emerging artists, 8.7% avg engagement
              </div>
            </div>

            <div className="panel p-2 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-ralph-pink/20 border border-ralph-pink/40" />
                <div>
                  <div className="text-white/80 text-[11px] font-medium">@trendsettervibes</div>
                  <div className="text-white/50 text-[9px]">850K followers • Dance trends</div>
                </div>
              </div>
              <div className="text-white/60 text-[10px]">
                Creates viral dance content, strong Gen Z audience
              </div>
            </div>

            <div className="panel p-2 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-ralph-pink/20 border border-ralph-pink/40" />
                <div>
                  <div className="text-white/80 text-[11px] font-medium">@culturecollective</div>
                  <div className="text-white/50 text-[9px]">450K followers • Micro-influencer</div>
                </div>
              </div>
              <div className="text-white/60 text-[10px]">
                Authentic voice, high trust factor with followers
              </div>
            </div>
          </div>

          <button
            onClick={(e) => e.stopPropagation()}
            className="w-full px-3 py-2 rounded bg-ralph-pink/70 hover:bg-ralph-pink text-xs font-medium"
          >
            Connect with Creators
          </button>
        </div>
      )
    }

    return null
  }

  return (
    <div className="relative w-full h-screen">
      {/* Floating Header */}
      <div className="absolute top-4 left-4 right-4 z-50">
        <div className="panel p-3 flex items-center justify-between backdrop-blur-lg bg-charcoal-900/80">
          <div className="flex items-center gap-2 text-xs">
            {concept && <div className="px-2 py-1 rounded bg-ralph-cyan/20 border border-ralph-cyan/40">{concept}</div>}
            {persona && <div className="px-2 py-1 rounded bg-white/10 border border-white/20">Persona: {persona}</div>}
            {region && <div className="px-2 py-1 rounded bg-white/10 border border-white/20">Region: {region}</div>}
          </div>
        </div>
      </div>

      {/* Canvas with Nodes */}
      <Canvas nodes={nodes} onNodesChange={setNodes} renderNodeContent={renderNodeContent} />

      {/* Floating RalphBot Assistant */}
      <FloatingAssistant />
    </div>
  )
}
