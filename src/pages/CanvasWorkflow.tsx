import { useState, useEffect } from 'react'
import Canvas from '../components/Canvas/Canvas'
import { NodeData } from '../components/Canvas/Node'
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
        y: 50,
        width: 400,
        height: 200,
        minimized: false,
        zIndex: 1,
        status: 'active'
      },
      {
        id: 'context-upload',
        type: 'upload',
        title: 'Context & Files',
        x: 50,
        y: 280,
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

  // Progressive reveal: Add nodes as workflow progresses
  useEffect(() => {
    if (activated && !nodes.find(n => n.id === 'debrief')) {
      setNodes(prev => [
        ...prev,
        {
          id: 'debrief',
          type: 'debrief',
          title: 'AI Analysis',
          x: 500,
          y: 50,
          width: 450,
          height: 400,
          minimized: false,
          zIndex: 2,
          status: 'active',
          connectedTo: ['brief-input', 'context-upload']
        },
        {
          id: 'copilot',
          type: 'copilot',
          title: 'Co-Pilot',
          x: 1000,
          y: 50,
          width: 350,
          height: 500,
          minimized: false,
          zIndex: 10, // Floating above everything
          status: 'active'
        }
      ])
    }
  }, [activated, nodes])

  const handleSubmit = () => {
    if (!concept) return
    setActivated(true)
    // Mark brief as complete
    setNodes(prev => prev.map(n =>
      n.id === 'brief-input' ? { ...n, status: 'complete' as const } : n
    ))
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

    if (node.id === 'debrief') {
      return (
        <div className="space-y-3 text-xs">
          <div className="text-white/80 leading-relaxed">
            AI is analyzing your campaign concept and uploaded context...
          </div>
          <div className="panel p-2 bg-white/5">
            <div className="text-white/60 mb-1">Key Insights</div>
            <ul className="space-y-1 text-white/70 text-[11px]">
              <li>• Analyzing narrative strength...</li>
              <li>• Identifying cross-platform potential...</li>
              <li>• Computing optimal timing...</li>
            </ul>
          </div>
        </div>
      )
    }

    if (node.id === 'copilot') {
      return (
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-auto space-y-2 text-xs mb-2">
            <div className="p-2 rounded bg-ralph-purple/20 border border-ralph-purple/30">
              <div className="text-white/60 text-[10px] mb-1">Co-Pilot</div>
              <div className="text-white/80">Welcome! I'm here to guide you through the campaign workflow. Start by entering your story brief above.</div>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ask Co-Pilot..."
              onMouseDown={(e) => e.stopPropagation()}
              className="flex-1 bg-charcoal-800/70 border border-white/10 rounded px-2 py-1 text-xs"
            />
            <button
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="px-3 py-1 rounded bg-ralph-pink/70 hover:bg-ralph-pink text-xs"
            >
              Send
            </button>
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
    </div>
  )
}
