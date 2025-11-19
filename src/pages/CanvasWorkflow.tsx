import { useState, useEffect, useRef } from 'react'
import Canvas from '../components/Canvas/Canvas'
import { NodeData } from '../components/Canvas/Node'
import FloatingAssistant from '../components/Canvas/FloatingAssistant'
import { useDashboard } from '../context/DashboardContext'
import { useUpload } from '../context/UploadContext'
import { api } from '../services/api'
import { CitationToken } from '../components/shared/CitationOverlay'

const API_BASE = ((import.meta as any).env?.VITE_API_BASE as string | undefined) || ''
const USER_ID = '087d78e9-4bbe-49f6-8981-1588ce4934a2'

export default function CanvasWorkflow() {
  const { concept, setConcept, activated, setActivated, persona, setPersona, region, setRegion } = useDashboard() as any
  const { addFiles, addUrl, processed } = useUpload()
  const [nodes, setNodes] = useState<NodeData[]>([])

  // Backend data state
  const [debrief, setDebrief] = useState<{ brief: string; summary: string; keyPoints: string[]; didYouKnow: string[]; sources?: any } | null>(null)
  const [opps, setOpps] = useState<{ opportunities: { title: string; why: string; impact: number }[]; rationale?: string; sources?: any } | null>(null)
  const [loading, setLoading] = useState(false)
  const [debriefAccepted, setDebriefAccepted] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Opportunity selection
  const [selectedOpportunities, setSelectedOpportunities] = useState<Set<string>>(new Set())

  // Narrative state
  const [narrative, setNarrative] = useState<{ text: string } | null>(null)
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [narrativeApproved, setNarrativeApproved] = useState(false)
  const [narrativeChatMessages, setNarrativeChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [narrativeChatInput, setNarrativeChatInput] = useState('')

  // Track if nodes have been stacked to avoid infinite loops
  const [nodesStacked, setNodesStacked] = useState(false)
  // Track if narrative has been generated to avoid infinite loops
  const [narrativeGenerated, setNarrativeGenerated] = useState(false)

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
        status: 'idle'
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

  // Call real backend APIs when workflow is activated
  useEffect(() => {
    let cancel = false
    if (!activated || !concept) return

    setLoading(true)
    ;(async () => {
      try {
        // Check if there's an existing project from file uploads
        let projectId = localStorage.getItem('activeProjectId')
        const isValidUUID = projectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)

        if (isValidUUID) {
          console.log('[Canvas] Using existing project:', projectId)
        } else {
          console.log('[Canvas] No project - will use Core RKB + Live Metrics only')
          projectId = null
        }

        const [d, o] = await Promise.all([
          api.debrief(concept, { persona, region, projectId: projectId || undefined }),
          api.opportunities(concept, { persona, region, projectId: projectId || undefined })
        ])
        if (!cancel) {
          setDebrief(d)
          setOpps(o)
          setLoading(false)
          // Mark debrief node as complete after data loads
          setNodes(prev => prev.map(n =>
            n.id === 'debrief-opportunities' ? { ...n, status: 'complete' as const } : n
          ))
        }
      } catch (err) {
        console.error('Failed to load debrief/opportunities:', err)
        if (!cancel) setLoading(false)
      }
    })()

    return () => { cancel = true }
  }, [activated, concept, persona, region])

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

  // Stack and minimize left nodes when debrief opens
  useEffect(() => {
    if (activated && !nodesStacked && nodes.find(n => n.id === 'debrief-opportunities')) {
      setNodesStacked(true)
      setNodes(prev => prev.map(node => {
        // Minimize and stack the three left nodes
        if (node.id === 'brief-input') {
          return { ...node, x: 50, y: 100, width: 280, minimized: true }
        }
        if (node.id === 'context-upload') {
          return { ...node, x: 50, y: 160, width: 280, minimized: true }
        }
        if (node.id === 'rkb') {
          return { ...node, x: 50, y: 220, width: 280, minimized: true }
        }
        return node
      }))
    }
  }, [activated, nodesStacked, nodes.length])

  // Step 2: Add Narrative Structure ONLY after user accepts Debrief
  useEffect(() => {
    if (!debriefAccepted || nodes.find(n => n.id === 'narrative')) return

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
        height: 500,
        minimized: false,
        zIndex: 3,
        status: 'processing',
        connectedTo: ['debrief-opportunities']
      }
    ])
  }, [debriefAccepted, nodes])

  // Generate narrative with selected opportunities
  useEffect(() => {
    let cancel = false
    if (!debriefAccepted || narrativeGenerated || !nodes.find(n => n.id === 'narrative') || narrative) return

    setNarrativeGenerated(true)
    setNarrativeLoading(true)
    ;(async () => {
      try {
        // Build graph with selected opportunities
        const selectedOppsList = opps?.opportunities?.filter(o => selectedOpportunities.has(o.title)) || []
        const graph = {
          concept,
          persona,
          region,
          debrief: debrief?.brief,
          opportunities: selectedOppsList,
          selectedOpportunities: Array.from(selectedOpportunities)
        }

        const narrativeResult = await api.narrative(graph)

        if (!cancel) {
          setNarrative(narrativeResult)
          setNarrativeLoading(false)
          // Mark narrative node as complete
          setNodes(prev => prev.map(n =>
            n.id === 'narrative' ? { ...n, status: 'complete' as const } : n
          ))
        }
      } catch (err) {
        console.error('Failed to generate narrative:', err)
        if (!cancel) setNarrativeLoading(false)
      }
    })()

    return () => { cancel = true }
  }, [debriefAccepted, narrativeGenerated])

  // Step 3: Add Scoring & Enhancements ONLY after narrative is approved
  useEffect(() => {
    if (!narrativeApproved || nodes.find(n => n.id === 'scoring')) return

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

    // Mark as complete after 3 seconds (TODO: integrate real API)
    setTimeout(() => {
      setNodes(prev => prev.map(n =>
        n.id === 'scoring' ? { ...n, status: 'complete' as const } : n
      ))
    }, 3000)
  }, [narrativeApproved, nodes])

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

    // Minimize Story Brief and Context nodes after submit
    setNodes(prev => prev.map(n => {
      if (n.id === 'brief-input' || n.id === 'context-upload') {
        return { ...n, minimized: true, status: 'idle' as const }
      }
      return n
    }))
  }

  // File upload helper
  const handleFileUpload = async (files: FileList | File[]) => {
    try {
      console.log('[CanvasWorkflow] Starting file upload:', files.length, 'files')
      await addFiles(Array.from(files))
      console.log('[CanvasWorkflow] File upload successful')
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('[CanvasWorkflow] Upload failed:', err)
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileUpload(files)
    }
  }

  // Re-assessment trigger: If files are added after workflow is activated, re-trigger debrief
  useEffect(() => {
    if (activated && processed.length > 0) {
      // Set debrief status back to processing when new files are added
      setNodes(prev => prev.map(n => {
        if (n.id === 'debrief-opportunities') {
          return { ...n, status: 'processing' as const }
        }
        return n
      }))

      // Simulate re-processing after 2 seconds
      const timer = setTimeout(() => {
        setNodes(prev => prev.map(n => {
          if (n.id === 'debrief-opportunities') {
            return { ...n, status: 'complete' as const }
          }
          return n
        }))
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [processed.length, activated])

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
              <option value="" disabled>Select Persona</option>
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
              <option value="" disabled>Select Region</option>
              <option value="Worldwide">Worldwide</option>
              <option value="US">US</option>
              <option value="UK">UK</option>
              <option value="EU">EU</option>
              <option value="Asia Pacific">Asia Pacific</option>
            </select>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={!concept || !persona || !region}
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
            {processed.length} file{processed.length !== 1 ? 's' : ''} uploaded {processed.length === 0 && '(optional)'}
          </div>

          {/* Show uploaded files */}
          {processed.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2 max-h-20 overflow-auto">
              {processed.map((p, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-ralph-cyan/10 border border-ralph-cyan/30 text-[10px] flex items-center gap-1">
                  {p.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // Could add removeContent(p.id) here if needed
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="text-white/60 hover:text-white/90"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileUpload(e.target.files)
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="hidden"
            id="canvas-file-upload"
          />

          {/* Drag-and-drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
            className={`block w-full px-3 py-3 rounded border-2 border-dashed text-xs text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-ralph-cyan bg-ralph-cyan/10 text-white/90'
                : 'border-white/20 hover:border-ralph-cyan/40 text-white/60 hover:text-white/80'
            }`}
          >
            {isDragging ? (
              <span>Drop files here...</span>
            ) : (
              <span>+ Drag & Drop or Click to Add Files (Optional)</span>
            )}
          </div>
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
      // Build citation map from sources
      const allSources = [
        ...(debrief?.sources?.core || []),
        ...(debrief?.sources?.project || []),
        ...(debrief?.sources?.live || [])
      ]

      // Create citation lookup
      const getCitationInfo = (index: number) => {
        const source = allSources[index]
        if (!source) return null

        // Parse source format: "type:name" or "filename"
        if (typeof source === 'string') {
          if (source.startsWith('trend:')) {
            const name = source.replace('trend:', '')
            return { label: `Trend`, detail: name }
          } else if (source.startsWith('creator:')) {
            const name = source.replace('creator:', '')
            return { label: `Creator`, detail: name }
          } else if (source.includes('.pdf') || source.includes('.docx')) {
            // RKB file
            const filename = source.split('/').pop() || source
            return { label: `RKB Document`, detail: filename }
          } else {
            return { label: `Source`, detail: source }
          }
        }
        // Handle object sources
        if (typeof source === 'object' && source !== null) {
          const src = source as any
          return {
            label: src.type || src.platform || 'Source',
            detail: src.title || src.filename || src.name || JSON.stringify(source).substring(0, 200)
          }
        }
        return null
      }

      let citationIndex = 1

      return (
        <div className="space-y-3 text-xs max-h-full overflow-auto">
          {loading || !debrief ? (
            <div className="text-white/80 leading-relaxed">
              AI is analyzing your campaign with RKB semantic search and trends data...
            </div>
          ) : (
            <>
              {/* DEBRIEF Section */}
              <div className="panel p-3 bg-white/5">
                <div className="text-white/70 font-medium mb-2 text-[11px]">DEBRIEF</div>
                <div className="text-white/80 text-[11px] leading-relaxed mb-2">{debrief.brief}</div>
                <div className="text-white/60 text-[10px] leading-relaxed mb-2">{debrief.summary}</div>

                {/* Key Points */}
                {debrief.keyPoints && debrief.keyPoints.length > 0 && (
                  <div className="mt-3">
                    <div className="text-white/60 font-medium mb-1 text-[10px]">Key Points</div>
                    <ul className="list-disc pl-4 space-y-1">
                      {debrief.keyPoints.map((p, i) => {
                        const citInfo = getCitationInfo(i)
                        const currentIndex = citationIndex++
                        return (
                          <li key={i} className="text-white/70 text-[10px]">
                            {p}
                            {citInfo && (
                              <span className="ml-1 align-middle">
                                <CitationToken
                                  id={currentIndex}
                                  label={citInfo.label}
                                  detail={citInfo.detail}
                                />
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {/* Did You Know */}
                {debrief.didYouKnow && debrief.didYouKnow.length > 0 && (
                  <div className="mt-3 p-2 bg-ralph-teal/15 border border-ralph-teal/30 rounded">
                    <div className="text-white/70 font-medium mb-1 text-[10px]">Did You Know</div>
                    <div className="flex flex-wrap gap-1.5">
                      {debrief.didYouKnow.map((x, i) => {
                        const sourceIndex = debrief.keyPoints.length + i
                        const citInfo = getCitationInfo(sourceIndex)
                        const currentIndex = citationIndex++
                        return (
                          <span key={i} className="px-2 py-1 rounded bg-white/10 border border-white/20 text-[10px]">
                            {x}
                            {citInfo && (
                              <CitationToken
                                id={currentIndex}
                                label={citInfo.label}
                                detail={citInfo.detail}
                              />
                            )}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* OPPORTUNITIES Section */}
              <div className="panel p-3 bg-white/5">
                <div className="text-white/70 font-medium mb-2 text-[11px]">OPPORTUNITIES</div>
                <div className="space-y-2">
                  {opps?.opportunities?.map((o, i) => {
                    const isSelected = selectedOpportunities.has(o.title)
                    return (
                      <label key={i} className="flex items-start gap-2 p-2 bg-white/5 rounded border border-white/10 cursor-pointer hover:border-ralph-cyan/30 transition-colors">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation()
                            const newSelected = new Set(selectedOpportunities)
                            if (e.target.checked) {
                              newSelected.add(o.title)
                            } else {
                              newSelected.delete(o.title)
                            }
                            setSelectedOpportunities(newSelected)
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1">
                          <div className="text-white/90 font-medium text-[10px] mb-1">{o.title}</div>
                          <div className="text-white/70 text-[10px] leading-relaxed">{o.why}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
                {opps?.rationale && (
                  <div className="mt-2 text-[10px] text-white/50">{opps.rationale}</div>
                )}
                <div className="mt-2 text-[10px] text-ralph-cyan">
                  {selectedOpportunities.size} opportunit{selectedOpportunities.size !== 1 ? 'ies' : 'y'} selected
                </div>
              </div>

              {/* Chatbot Field */}
              <div className="panel p-2 bg-white/5">
                <div className="text-white/70 font-medium mb-2 text-[10px]">DISCUSS & REFINE</div>
                <div className="space-y-2 max-h-32 overflow-auto mb-2">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`text-[10px] p-2 rounded ${msg.role === 'user' ? 'bg-ralph-cyan/10 border border-ralph-cyan/20 text-white/90' : 'bg-white/5 text-white/70'}`}>
                      {msg.text}
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation()
                        if (chatInput.trim()) {
                          setChatMessages(prev => [...prev, { role: 'user', text: chatInput }])
                          setChatInput('')
                          // Simulate AI response
                          setTimeout(() => {
                            setChatMessages(prev => [...prev, { role: 'ai', text: 'I understand your feedback. Let me help refine these opportunities based on your input.' }])
                          }, 500)
                        }
                      }
                    }}
                    placeholder="Ask questions or refine opportunities..."
                    className="flex-1 bg-charcoal-800/70 border border-white/10 rounded px-2 py-1 text-[10px] outline-none"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (chatInput.trim()) {
                        setChatMessages(prev => [...prev, { role: 'user', text: chatInput }])
                        setChatInput('')
                        setTimeout(() => {
                          setChatMessages(prev => [...prev, { role: 'ai', text: 'I understand your feedback. Let me help refine these opportunities based on your input.' }])
                        }, 500)
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-2 py-1 rounded bg-ralph-cyan/70 hover:bg-ralph-cyan text-[10px]"
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Accept Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDebriefAccepted(true)
                }}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={debriefAccepted}
                className="w-full px-3 py-2 rounded bg-ralph-cyan/70 hover:bg-ralph-cyan text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {debriefAccepted ? 'Accepted ✓' : 'Accept & Continue to Narrative'}
              </button>
            </>
          )}
        </div>
      )
    }

    if (node.id === 'narrative') {
      return (
        <div className="space-y-3 text-xs max-h-full overflow-auto">
          {narrativeLoading || !narrative ? (
            <div className="text-white/80 leading-relaxed">
              Composing end-to-end narrative structure with selected opportunities...
            </div>
          ) : (
            <>
              {/* Narrative Content */}
              <div className="panel p-3 bg-white/5">
                <div className="text-white/70 font-medium mb-2 text-[11px]">NARRATIVE STRUCTURE</div>
                <div className="text-white/80 text-[10px] leading-relaxed whitespace-pre-wrap">
                  {narrative.text}
                </div>
              </div>

              {/* Show selected opportunities that were integrated */}
              {selectedOpportunities.size > 0 && (
                <div className="panel p-2 bg-ralph-cyan/10 border border-ralph-cyan/30">
                  <div className="text-white/70 font-medium mb-1 text-[10px]">INTEGRATED OPPORTUNITIES</div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(selectedOpportunities).map((opp, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-white/10 border border-white/20 text-[9px]">
                        {opp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Chatbot Field */}
              <div className="panel p-2 bg-white/5">
                <div className="text-white/70 font-medium mb-2 text-[10px]">DISCUSS & REFINE</div>
                <div className="space-y-2 max-h-32 overflow-auto mb-2">
                  {narrativeChatMessages.map((msg, i) => (
                    <div key={i} className={`text-[10px] p-2 rounded ${msg.role === 'user' ? 'bg-ralph-cyan/10 border border-ralph-cyan/20 text-white/90' : 'bg-white/5 text-white/70'}`}>
                      {msg.text}
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={narrativeChatInput}
                    onChange={(e) => setNarrativeChatInput(e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation()
                        if (narrativeChatInput.trim()) {
                          setNarrativeChatMessages(prev => [...prev, { role: 'user', text: narrativeChatInput }])
                          setNarrativeChatInput('')
                          setTimeout(() => {
                            setNarrativeChatMessages(prev => [...prev, { role: 'ai', text: 'I can help you refine the narrative structure. What aspects would you like to adjust?' }])
                          }, 500)
                        }
                      }
                    }}
                    placeholder="Ask questions or request changes..."
                    className="flex-1 bg-charcoal-800/70 border border-white/10 rounded px-2 py-1 text-[10px] outline-none"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (narrativeChatInput.trim()) {
                        setNarrativeChatMessages(prev => [...prev, { role: 'user', text: narrativeChatInput }])
                        setNarrativeChatInput('')
                        setTimeout(() => {
                          setNarrativeChatMessages(prev => [...prev, { role: 'ai', text: 'I can help you refine the narrative structure. What aspects would you like to adjust?' }])
                        }, 500)
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-2 py-1 rounded bg-ralph-cyan/70 hover:bg-ralph-cyan text-[10px]"
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Approve Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setNarrativeApproved(true)
                }}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={narrativeApproved}
                className="w-full px-3 py-2 rounded bg-ralph-cyan/70 hover:bg-ralph-cyan text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {narrativeApproved ? 'Approved ✓' : 'Approve & Continue to Scoring'}
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
      {/* Fixed Header - stays under main header */}
      <div className="fixed top-16 left-4 right-4 z-50">
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
