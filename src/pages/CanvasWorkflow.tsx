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

  // Progressive reveal: Add RKB and Debrief nodes when workflow progresses
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
        // Debrief node (AI-content, orange) - connects from Brief, Context, and RKB
        {
          id: 'debrief',
          type: 'debrief',
          title: 'AI Analysis',
          x: 500,
          y: 100,
          width: 450,
          height: 400,
          minimized: false,
          zIndex: 2,
          status: 'processing',
          connectedTo: ['brief-input', 'context-upload', 'rkb']
        }
      ])
    }
  }, [activated, nodes])

  // Add Opportunities node after Debrief completes (simulated after 3 seconds)
  useEffect(() => {
    if (!nodes.find(n => n.id === 'debrief')) return

    const debriefNode = nodes.find(n => n.id === 'debrief')
    if (debriefNode?.status === 'processing' && !nodes.find(n => n.id === 'opportunities')) {
      // Simulate debrief completion and add Opportunities
      const timer = setTimeout(() => {
        setNodes(prev => prev.map(n =>
          n.id === 'debrief' ? { ...n, status: 'complete' as const } : n
        ))

        setTimeout(() => {
          setNodes(prev => [
            ...prev,
            // Opportunities node (AI-content, orange)
            {
              id: 'opportunities',
              type: 'ai-content',
              title: 'Opportunities',
              x: 1000,
              y: 100,
              width: 400,
              height: 350,
              minimized: false,
              zIndex: 3,
              status: 'processing',
              connectedTo: ['debrief']
            },
            // RalphBot interaction node (pink)
            {
              id: 'ralphbot-opportunities',
              type: 'ralphbot',
              title: 'RalphBot Guidance',
              x: 1000,
              y: 480,
              width: 400,
              height: 180,
              minimized: false,
              zIndex: 3,
              status: 'active',
              connectedTo: ['opportunities']
            }
          ])
        }, 500)
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [nodes])

  // Add Creator node after RalphBot interaction
  useEffect(() => {
    const ralphbotNode = nodes.find(n => n.id === 'ralphbot-opportunities')
    if (ralphbotNode && !nodes.find(n => n.id === 'creator')) {
      // Simulate user interaction with RalphBot, then add Creator
      const timer = setTimeout(() => {
        setNodes(prev => [
          ...prev,
          // Creator node (AI-content, orange)
          {
            id: 'creator',
            type: 'ai-content',
            title: 'Content Creator',
            x: 1450,
            y: 100,
            width: 400,
            height: 500,
            minimized: false,
            zIndex: 4,
            status: 'processing',
            connectedTo: ['opportunities', 'ralphbot-opportunities']
          }
        ])

        // Mark Opportunities as complete
        setTimeout(() => {
          setNodes(prev => prev.map(n =>
            n.id === 'opportunities' ? { ...n, status: 'complete' as const } : n
          ))
        }, 1000)
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

    if (node.id === 'debrief') {
      return (
        <div className="space-y-3 text-xs">
          <div className="text-white/80 leading-relaxed">
            {node.status === 'processing'
              ? 'AI is analyzing your campaign concept with uploaded context and RKB insights...'
              : 'Analysis complete. Your campaign has strong narrative potential with cross-platform opportunities.'}
          </div>
          <div className="panel p-2 bg-white/5">
            <div className="text-white/60 mb-1">Key Insights</div>
            <ul className="space-y-1 text-white/70 text-[11px]">
              <li>• Strong cultural relevance detected</li>
              <li>• High engagement potential across TikTok, Instagram</li>
              <li>• Optimal launch timing: Q4 2024</li>
              <li>• Synergy with current music trends</li>
            </ul>
          </div>
        </div>
      )
    }

    if (node.id === 'opportunities') {
      return (
        <div className="space-y-3 text-xs">
          <div className="text-white/80 leading-relaxed mb-2">
            {node.status === 'processing'
              ? 'Identifying strategic opportunities...'
              : 'Strategic opportunities identified'}
          </div>
          <div className="space-y-2">
            <div className="panel p-2 bg-white/5">
              <div className="text-ralph-cyan text-[11px] font-medium mb-1">Platform Strategy</div>
              <div className="text-white/70 text-[10px]">TikTok-first approach with Instagram Reels crossover</div>
            </div>
            <div className="panel p-2 bg-white/5">
              <div className="text-ralph-cyan text-[11px] font-medium mb-1">Influencer Partnerships</div>
              <div className="text-white/70 text-[10px]">3 micro-influencers + 1 mid-tier creator</div>
            </div>
            <div className="panel p-2 bg-white/5">
              <div className="text-ralph-cyan text-[11px] font-medium mb-1">Content Mix</div>
              <div className="text-white/70 text-[10px]">60% native, 30% UGC, 10% branded</div>
            </div>
          </div>
        </div>
      )
    }

    if (node.id === 'ralphbot-opportunities') {
      return (
        <div className="space-y-2 text-xs">
          <div className="text-white/80 leading-relaxed text-[11px]">
            💬 Ready to refine your strategy? I can help you:
          </div>
          <div className="space-y-1 text-white/70 text-[10px]">
            <div className="p-1.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
              → Adjust platform priorities</div>
            <div className="p-1.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
              → Explore alternative influencers</div>
            <div className="p-1.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
              → Generate content variants</div>
          </div>
        </div>
      )
    }

    if (node.id === 'creator') {
      return (
        <div className="space-y-3 text-xs">
          <div className="text-white/80 leading-relaxed mb-2">
            {node.status === 'processing'
              ? 'Generating content assets...'
              : 'Content ready for review'}
          </div>
          <div className="space-y-2 max-h-80 overflow-auto">
            <div className="panel p-2 bg-white/5">
              <div className="text-ralph-pink text-[11px] font-medium mb-1">Video Script #1</div>
              <div className="text-white/70 text-[10px] mb-2">15s TikTok hook + main narrative</div>
              <div className="text-white/50 text-[9px] italic line-clamp-2">
                "POV: When the algorithm finally gets you..."
              </div>
            </div>
            <div className="panel p-2 bg-white/5">
              <div className="text-ralph-pink text-[11px] font-medium mb-1">Caption Set</div>
              <div className="text-white/70 text-[10px]">5 platform-optimized variants</div>
            </div>
            <div className="panel p-2 bg-white/5">
              <div className="text-ralph-pink text-[11px] font-medium mb-1">Hashtag Strategy</div>
              <div className="text-white/70 text-[10px]">#trending mix + branded tags</div>
            </div>
            <div className="panel p-2 bg-white/5">
              <div className="text-ralph-pink text-[11px] font-medium mb-1">Visual Moodboard</div>
              <div className="text-white/70 text-[10px]">12 reference images compiled</div>
            </div>
          </div>
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
