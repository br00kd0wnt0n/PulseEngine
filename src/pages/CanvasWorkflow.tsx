import { useState, useEffect, useRef } from 'react'
import Canvas from '../components/Canvas/Canvas'
import { NodeData } from '../components/Canvas/Node'
import FloatingAssistant from '../components/Canvas/FloatingAssistant'
import { useDashboard } from '../context/DashboardContext'
import { useTrends } from '../context/TrendContext'
import { useUpload } from '../context/UploadContext'
import { api } from '../services/api'
import { CitationToken } from '../components/shared/CitationOverlay'

const API_BASE = ((import.meta as any).env?.VITE_API_BASE as string | undefined) || ''
const USER_ID = '087d78e9-4bbe-49f6-8981-1588ce4934a2'
const ENABLE_REMOTE_SAVE = Boolean((import.meta as any).env?.VITE_ENABLE_REMOTE_SAVE)

export default function CanvasWorkflow() {
  const { concept, setConcept, activated, setActivated, persona, setPersona, region, setRegion } = useDashboard() as any
  const { addFiles, addUrl, processed } = useUpload()
  const { snapshot, nodes: trendNodes } = useTrends()
  const [rkbActivity, setRkbActivity] = useState<{ id: number; text: string; kind?: 'rkb'|'project'|'trends'|'ai' }[]>([])
  const [stats, setStats] = useState<{ trends?: number; creators?: number; assets?: number } | null>(null)
  const hasPlaceholders = (items: any[]) => items.some(it => typeof it?.id === 'string' && (it.id.startsWith('placeholder-') || it.id.startsWith('url-placeholder-')))

  const addActivity = (text: string, kind?: 'rkb'|'project'|'trends'|'ai') => {
    setRkbActivity(prev => [{ id: Date.now(), text, kind }, ...prev].slice(0, 20))
  }

  // Manual re-evaluation trigger (Debrief + Opps, then optionally Narrative)
  const reEvaluateNow = async () => {
    if (!concept) return
    let projectId: string | null = null
    try { projectId = localStorage.getItem('activeProjectId') } catch {}
    setNodes(prev => prev.map(n => n.id === 'debrief-opportunities' ? { ...n, status: 'processing' as const } : n))
    addActivity('Manual re-evaluation started…', 'ai')
    try {
      const [d, o] = await Promise.all([
        api.debrief(concept, { persona, region, projectId: projectId || undefined }),
        api.opportunities(concept, { persona, region, projectId: projectId || undefined })
      ])
      console.log('[Debrief] Sources:', d?.sources)
      setDebrief(d)
      setOpps(o)
      try { if (projectId) localStorage.setItem(`debrief:${projectId}`, JSON.stringify(d)) } catch {}
      try { if (projectId) localStorage.setItem(`opps:${projectId}`, JSON.stringify(o)) } catch {}
      setNodes(prev => prev.map(n => n.id === 'debrief-opportunities' ? { ...n, status: 'complete' as const } : n))
      addActivity('Debrief updated with project context', 'ai')
      if (debriefAccepted) {
        setNodes(prev => prev.map(n => n.id === 'narrative' ? { ...n, status: 'processing' as const } : n))
        setNarrativeGenerated(false)
      }
    } catch (e) {
      addActivity('Re-evaluation failed — check connection', 'ai')
      setNodes(prev => prev.map(n => n.id === 'debrief-opportunities' ? { ...n, status: 'active' as const } : n))
    }
  }

  // Ensure narrative node exists helper
  const ensureNarrativeNode = () => {
    if (!nodes.find(n => n.id === 'narrative')) {
      setNodes(prev => ([
        ...prev,
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
          status: 'processing' as const,
          connectedTo: ['debrief-opportunities']
        }
      ]))
    }
  }
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
  const [narrativeRefreshRequested, setNarrativeRefreshRequested] = useState(false)
  const debriefRefreshInFlight = useRef(false)

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

  // Ensure server project exists on mount (Canvas-first)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        let projectId: string | null = null
        try { projectId = localStorage.getItem('activeProjectId') } catch {}
        const isUUID = projectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
        if (isUUID) return
        // If no id, seed local and then try to create a server project
        const localId = projectId && projectId.startsWith('local-') ? projectId : `local-${Date.now()}`
        try { localStorage.setItem('activeProjectId', localId) } catch {}
        addActivity('Initializing project…', 'project')
        try {
          const created = await api.createPublicProject({ concept: (concept || 'Untitled Project'), graph: snapshot(), focusId: null })
          if (!cancelled && created && created.id && typeof created.id === 'string') {
            // migrate local keys to server id
            const newId = created.id
            const migrate = (keyBase: string) => {
              try {
                const oldKey = `${keyBase}:${localId}`
                const val = localStorage.getItem(oldKey)
                if (val) {
                  localStorage.setItem(`${keyBase}:${newId}`, val)
                  localStorage.removeItem(oldKey)
                }
              } catch {}
            }
            migrate('debrief'); migrate('opps'); migrate('nf'); migrate('conv'); migrate('versions')
            try { localStorage.setItem('activeProjectId', newId) } catch {}
            addActivity('Project ready on server', 'project')
          }
        } catch {
          if (!cancelled) addActivity('Working locally; server project not available', 'project')
        }
      } catch {}
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch global stats for accurate counts (trends/creators/assets)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const ov = await api.statusOverview().catch(() => null)
        if (cancelled || !ov) return
        setStats({ trends: ov.stats?.trends, creators: ov.stats?.creators, assets: ov.stats?.assets })
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  // Record context ingestion activity from uploads/URL adds
  useEffect(() => {
    const onContext = () => addActivity('New context ingested from uploads', 'project')
    window.addEventListener('context-updated', onContext as any)
    return () => {
      window.removeEventListener('context-updated', onContext as any)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Call real backend APIs when workflow is activated (wait for assessed context if any uploads exist)
  useEffect(() => {
    let cancel = false
    if (!activated || !concept) return
    // If there are uploads, wait until they are assessed (placeholders replaced)
    const hasUploads = (processed?.length || 0) > 0
    const uploadsAssessed = !hasUploads || (hasUploads && !hasPlaceholders(processed))
    if (!uploadsAssessed) {
      addActivity('Waiting for project context to be assessed…', 'project')
      return
    }

    setLoading(true)
    ;(async () => {
      try {
        // Ensure a project id exists for this Canvas session
        let projectId: string | null = null
        try { projectId = localStorage.getItem('activeProjectId') } catch {}
        const isValidUUID = projectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)

        if (isValidUUID) {
          console.log('[Canvas] Using existing project:', projectId)
        } else {
          const localId = (projectId && projectId.startsWith('local-')) ? projectId : `local-${Date.now()}`
          try { localStorage.setItem('activeProjectId', localId) } catch {}
          projectId = localId
          console.log('[Canvas] Initialized local project:', localId)
          addActivity('Initialized local project context', 'project')
          // Try to create a real project in the background and upgrade the id
          try {
            const created = await api.createPublicProject({ concept, graph: snapshot(), focusId: null })
            if (created && created.id && typeof created.id === 'string') {
              // Migrate any local keys to the new project id
              const newId = created.id
              const migrate = (keyBase: string) => {
                try {
                  const oldKey = `${keyBase}:${localId}`
                  const val = localStorage.getItem(oldKey)
                  if (val) {
                    localStorage.setItem(`${keyBase}:${newId}`, val)
                    localStorage.removeItem(oldKey)
                  }
                } catch {}
              }
              migrate('debrief'); migrate('opps'); migrate('nf'); migrate('conv'); migrate('versions')
              try { localStorage.setItem('activeProjectId', newId) } catch {}
              projectId = newId
              console.log('[Canvas] Upgraded to server project:', newId)
              addActivity('Project created on server and upgraded', 'project')
            }
          } catch (e) {
            console.log('[Canvas] Public project creation skipped/failure, staying local')
            addActivity('Working locally; server project not created', 'project')
          }
        }
        addActivity('Analyzing with RKB + live trends + project context…', 'ai')
        const [d, o] = await Promise.all([
          api.debrief(concept, { persona, region, projectId: projectId || undefined }),
          api.opportunities(concept, { persona, region, projectId: projectId || undefined })
        ])
        if (!cancel) {
          console.log('[Debrief] Sources:', d?.sources)
          setDebrief(d)
          setOpps(o)
          setLoading(false)
          // Persist to local storage for cross‑component visibility and exports
          try { localStorage.setItem(`debrief:${projectId}`, JSON.stringify(d)) } catch {}
          try { localStorage.setItem(`opps:${projectId}`, JSON.stringify(o)) } catch {}
          // Persist assessment to project DB as a version snapshot (does not touch RKB)
          try {
            if (ENABLE_REMOTE_SAVE && projectId && /^[0-9a-f\-]{36}$/i.test(projectId)) {
              await api.saveVersion(projectId, { summary: concept, changeSummary: 'Debrief assessment', scores: { debrief: d, opportunities: o } })
            }
          } catch {}
          // Mark debrief node status depending on sufficiency
          const insufficient = !d || (!(d.brief && String(d.brief).trim().length >= 8) && !(Array.isArray(d.keyPoints) && d.keyPoints.length > 0))
          setNodes(prev => prev.map(n =>
            n.id === 'debrief-opportunities' ? { ...n, status: (insufficient ? 'active' : 'complete') as const } : n
          ))
          addActivity('Debrief & Opportunities ready', 'ai')
        }
      } catch (err) {
        console.error('Failed to load debrief/opportunities:', err)
        addActivity('Analysis failed — check connection', 'ai')
        if (!cancel) setLoading(false)
      }
    })()

    return () => { cancel = true }
  }, [activated, concept, persona, region, processed])

  // Step 1: Add RKB immediately; add Debrief only when uploads are assessed (or there are none)
  useEffect(() => {
    if (!activated) return
    const hasUploads = (processed?.length || 0) > 0
    const uploadsAssessed = !hasUploads || (hasUploads && !hasPlaceholders(processed))
    const hasRkb = !!nodes.find(n => n.id === 'rkb')
    const hasDebrief = !!nodes.find(n => n.id === 'debrief-opportunities')

    if (!hasRkb) {
      setNodes(prev => ([
        ...prev,
        { id: 'rkb', type: 'rkb', title: 'Ralph Knowledge Base', x: 50, y: 620, width: 300, height: 150, minimized: false, zIndex: 2, status: 'idle' as const },
      ]))
    }

    if (!hasDebrief && uploadsAssessed) {
      setNodes(prev => ([
        ...prev,
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
          status: 'processing' as const,
          connectedTo: ['brief-input', 'context-upload', 'rkb']
        }
      ]))
    }
  }, [activated, nodes, processed])

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
          return { ...node, x: 50, y: 220, width: 300, minimized: false }
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
    const narrativeNode = nodes.find(n => n.id === 'narrative')

    // Early return conditions with logging
    if (!debriefAccepted) {
      console.log('[Narrative] Waiting for debrief acceptance')
      return
    }
    if (narrativeGenerated && !narrativeRefreshRequested) {
      console.log('[Narrative] Already generated')
      return
    }
    if (!narrativeNode) {
      console.log('[Narrative] Waiting for narrative node to be created')
      return
    }
    if (narrative && !narrativeLoading && !narrativeRefreshRequested) {
      console.log('[Narrative] Narrative already exists')
      return
    }

    console.log('[Narrative] Starting narrative generation...')
    setNarrativeGenerated(true)
    setNarrativeLoading(true)
    addActivity('Generating Narrative structure…', 'ai')
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

        console.log('[Narrative] Calling API with graph:', graph)
        const narrativeResult = await api.narrative(graph)
        console.log('[Narrative] API response received:', narrativeResult)

        if (!cancel) {
          ensureNarrativeNode()
          setNarrative(narrativeResult)
          setNarrativeLoading(false)
          setNarrativeRefreshRequested(false)
          // Persist minimal narrative blocks for exports and other views
          try {
            const pid = (localStorage.getItem('activeProjectId') || 'local')
            const blocks = Array.isArray((narrativeResult as any).blocks)
              ? (narrativeResult as any).blocks
              : [{ key: 'narrative', content: (narrativeResult as any).text || '' }]
            localStorage.setItem(`nf:${pid}`, JSON.stringify(blocks))
          } catch {}
          // Save narrative snapshot to project DB version history
          try {
            const pid = localStorage.getItem('activeProjectId')
            if (ENABLE_REMOTE_SAVE && pid && /^[0-9a-f\-]{36}$/i.test(pid)) {
              await api.saveVersion(pid, { summary: concept, narrative: (narrativeResult as any).text || '', changeSummary: 'Narrative generated' })
            }
          } catch {}
          // Mark narrative node as complete
          setNodes(prev => prev.map(n =>
            n.id === 'narrative' ? { ...n, status: 'complete' as const } : n
          ))
          console.log('[Narrative] Generation complete')
          addActivity('Narrative structure ready', 'ai')
        }
      } catch (err) {
        console.error('[Narrative] Failed to generate narrative:', err)
        if (!cancel) {
          setNarrativeLoading(false)
          setNarrativeGenerated(false) // Reset so it can retry
          setNarrativeRefreshRequested(false)
        }
        addActivity('Narrative generation failed — try again', 'ai')
      }
    })()

    return () => { cancel = true }
  }, [debriefAccepted, narrativeGenerated, nodes.length, narrative, narrativeRefreshRequested])

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
      // Ensure server project before uploading so assets associate correctly
      let projectId: string | null = null
      try { projectId = localStorage.getItem('activeProjectId') } catch {}
      const isValidUUID = projectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
      if (!isValidUUID) {
        try {
          const created = await api.createPublicProject({ concept: concept || 'Untitled Project', graph: snapshot(), focusId: null })
          if (created && created.id && typeof created.id === 'string') {
            localStorage.setItem('activeProjectId', created.id)
            addActivity('Project created on server for uploads', 'project')
          }
        } catch (e) {
          console.warn('[CanvasWorkflow] Could not create server project before upload; proceeding local')
          if (!projectId || !projectId.startsWith('local-')) {
            const localId = `local-${Date.now()}`
            try { localStorage.setItem('activeProjectId', localId) } catch {}
          }
        }
      }
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

  // Re-evaluate Debrief/Opportunities (and Narrative if accepted) when context updates
  useEffect(() => {
    let t: any = null
    const handler = () => {
      if (!activated || !concept) return
      if (debriefRefreshInFlight.current) return
      let projectId: string | null = null
      try { projectId = localStorage.getItem('activeProjectId') } catch {}
      setNodes(prev => prev.map(n => n.id === 'debrief-opportunities' ? { ...n, status: 'processing' as const } : n))
      addActivity('Re-evaluating with new project context…', 'ai')
      if (t) clearTimeout(t)
      t = setTimeout(async () => {
        try {
          debriefRefreshInFlight.current = true
          const [d, o] = await Promise.all([
            api.debrief(concept, { persona, region, projectId: projectId || undefined }),
            api.opportunities(concept, { persona, region, projectId: projectId || undefined })
          ])
          console.log('[Debrief] Sources:', d?.sources)
          setDebrief(d)
          setOpps(o)
          try { if (projectId) localStorage.setItem(`debrief:${projectId}`, JSON.stringify(d)) } catch {}
          try { if (projectId) localStorage.setItem(`opps:${projectId}`, JSON.stringify(o)) } catch {}
          const insufficient = !d || (!(d.brief && String(d.brief).trim().length >= 8) && !(Array.isArray(d.keyPoints) && d.keyPoints.length > 0))
          setNodes(prev => prev.map(n => n.id === 'debrief-opportunities' ? { ...n, status: (insufficient ? 'active' : 'complete') as const } : n))
          addActivity('Debrief updated with project context', 'ai')
          // If narrative was accepted previously, refresh it as well
          if (debriefAccepted) {
            setNodes(prev => prev.map(n => n.id === 'narrative' ? { ...n, status: 'processing' as const } : n))
            setNarrativeRefreshRequested(true)
            setNarrativeGenerated(false)
          }
        } catch {
          addActivity('Re-evaluation failed — check connection', 'ai')
          setNodes(prev => prev.map(n => n.id === 'debrief-opportunities' ? { ...n, status: 'active' as const } : n))
        } finally {
          debriefRefreshInFlight.current = false
        }
      }, 700)
    }
    window.addEventListener('context-updated', handler as any)
    return () => { window.removeEventListener('context-updated', handler as any); if (t) clearTimeout(t) }
  }, [activated, concept, persona, region])

  const renderNodeContent = (node: NodeData) => {
    if (node.id === 'brief-input') {
      return (
        <div className="space-y-2">
          <textarea
            value={concept}
            onChange={(e) => { setConcept(e.target.value); try { localStorage.setItem('concept', e.target.value) } catch {} }}
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
      const trendsCount = (stats?.trends ?? (trendNodes || []).filter((n: any) => n.kind === 'trend').length)
      const creatorsCount = (stats?.creators ?? (trendNodes || []).filter((n: any) => n.kind === 'creator').length)
      const projectCount = processed.length
      const isProcessing = !!nodes.find(n => (n.id === 'debrief-opportunities' || n.id === 'narrative') && n.status === 'processing')
      return (
        <div className="space-y-2 text-xs">
          <div className="text-white/70 leading-relaxed text-[11px]">Ralph Knowledge Base connected</div>
          <div className="text-white/50 text-[10px]">
            Project context: {projectCount} item{projectCount === 1 ? '' : 's'} • Live Trends: {trendsCount} trends • {creatorsCount} creators
          </div>
          {isProcessing && (
            <div className="text-white/60 text-[10px] animate-pulse">Evaluating context and composing insights…</div>
          )}
          <div className="panel p-2 bg-white/5 border border-white/10 max-h-28 overflow-auto space-y-1">
            {rkbActivity.length === 0 ? (
              <div className="text-white/40 text-[10px]">No recent activity</div>
            ) : (
              rkbActivity.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-[10px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${a.kind === 'ai' ? 'bg-ralph-cyan' : a.kind === 'project' ? 'bg-ralph-pink' : 'bg-white/40'}`} />
                  <span className="text-white/70">{a.text}</span>
                </div>
              ))
            )}
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
          ) : (!debrief.brief && (!Array.isArray(debrief.keyPoints) || debrief.keyPoints.length === 0)) ? (
            <>
              <div className="panel p-3 bg-white/5 border border-white/10">
                <div className="text-white/80 text-[11px] leading-relaxed">
                  I need a bit more detail to produce a meaningful debrief.
                </div>
                <div className="mt-2 text-white/60 text-[10px]">
                  - Add 1–2 sentences to your Story Brief describing the goal, audience, or format<br/>
                  - Or upload 1–2 relevant documents for context
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); focusBrief() }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-2 py-1 rounded bg-ralph-cyan/70 hover:bg-ralph-cyan text-[10px]"
                  >
                    Edit Brief
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] border border-white/15"
                  >
                    Add Context
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* DEBRIEF Section */}
              <div className="panel p-3 bg-white/5">
                <div className="text-white/70 font-medium mb-2 text-[11px]">DEBRIEF</div>
                <div className="text-white/80 text-[11px] leading-relaxed mb-2">{debrief.brief}</div>
                <div className="text-white/60 text-[10px] leading-relaxed mb-2">{debrief.summary}</div>

                {/* Used Sources Summary */}
                <div className="mt-2">
                  <div className="text-white/50 text-[10px] mb-1">Used sources in this pass</div>
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Used RKB: {(debrief?.sources?.core || []).length}</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Used Project: {(debrief?.sources?.project || []).length}</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Used Live Trends: {(debrief?.sources?.live || []).length}</span>
                  </div>
                </div>

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

              {/* Manual Re-evaluate */}
              <div className="panel p-2 bg-white/5 flex items-center justify-between">
                <div className="text-white/60 text-[10px]">If you added new context, re-run analysis now.</div>
                <button
                  onClick={(e) => { e.stopPropagation(); reEvaluateNow() }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] border border-white/15"
                >
                  Re-evaluate now
                </button>
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
                disabled={debriefAccepted || node.status === 'processing' || ((processed?.length||0)>0 && hasPlaceholders(processed)) || !debrief || (!debrief.brief && (!Array.isArray(debrief.keyPoints) || debrief.keyPoints.length === 0))}
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
                {/* Used Sources Summary (derived from Debrief) */}
                <div className="mb-2 flex flex-wrap gap-2 text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">RKB: {(debrief?.sources?.core || []).length}</span>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Project: {(debrief?.sources?.project || []).length}</span>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">Live Trends: {(debrief?.sources?.live || []).length}</span>
                </div>
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
        <div className="panel p-3 backdrop-blur-lg bg-charcoal-900/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              {concept && <div className="px-2 py-1 rounded bg-ralph-cyan/20 border border-ralph-cyan/40">{concept}</div>}
              {persona && <div className="px-2 py-1 rounded bg-white/10 border border-white/20">Persona: {persona}</div>}
              {region && <div className="px-2 py-1 rounded bg-white/10 border border-white/20">Region: {region}</div>}
            </div>
          </div>
          {(processed.length > 0 && hasPlaceholders(processed)) && (
            <div className="mt-2 text-[10px] text-white/80 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ralph-cyan animate-pulse" />
              <span>Indexing uploaded context… Debrief will appear once ready.</span>
            </div>
          )}
        </div>
      </div>

      {/* Canvas with Nodes */}
      <Canvas nodes={nodes} onNodesChange={setNodes} renderNodeContent={renderNodeContent} />

      {/* Floating RalphBot Assistant */}
      <FloatingAssistant />
    </div>
  )
}
