import { useState, useEffect, useRef } from 'react'
import Canvas from '../components/Canvas/Canvas'
import { NodeData } from '../components/Canvas/Node'
import { useDashboard } from '../context/DashboardContext'
import { useTrends } from '../context/TrendContext'
import { useUpload } from '../context/UploadContext'
import { api } from '../services/api'
import { CitationToken } from '../components/shared/CitationOverlay'
import BrandSpinner from '../components/shared/BrandSpinner'
import { exportProjectFull, downloadMarkdown } from '../utils/export'

function renderMarkdown(md: string): string {
  // Basic safe renderer: escape HTML, then apply minimal markdown transforms
  const esc = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  let text = esc(md)

  // Remove standalone ** markers (lines that are just ** or whitespace + **)
  text = text.replace(/^\s*\*\*\s*$/gm, '')

  // Normalize bold-wrapped numbered headings like **1. Title:** to plain numbered heading
  text = text.replace(/^\s*\*\*(\d+\.\s+[^:\n]+:)\s*\*\*\s*$/gm, '$1')
  text = text.replace(/^\s*\*\*(\d+\.\s+[^:\n]+:)\s*/gm, '$1')

  // Headings ###
  text = text.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
  // Numbered sections like `1. Title:` -> <h4>Title</h4>
  text = text.replace(/^\s*\d+\.\s+([^:\n]+):/gm, '<h4>$1</h4>')
  // Subsection labels like `Content Pillars:` or `Story Arc:` -> <h5>
  text = text.replace(/^\s*([A-Z][A-Za-z ]+):$/gm, '<h5>$1</h5>')
  // Common subtitles (case-insensitive): Platform Strategy, Success Metrics, Content Pillars, How .* Integrates, Opening Hook
  text = text.replace(/^\s*(platform strategy.*)\s*:?\s*$/gim, (_, p1) => `<h5>${p1.trim()}</h5>`)
  text = text.replace(/^\s*(success metrics.*)\s*:?\s*$/gim,  (_, p1) => `<h5>${p1.trim()}</h5>`)
  text = text.replace(/^\s*(content pillars.*)\s*:?\s*$/gim,  (_, p1) => `<h5>${p1.trim()}</h5>`)
  text = text.replace(/^\s*(opening hook.*)\s*:?\s*$/gim,     (_, p1) => `<h5>${p1.trim()}</h5>`)
  text = text.replace(/^\s*(how .* integrates)\s*:?\s*$/gim,    (_, p1) => `<h5>${p1.trim()}</h5>`)
  // Bold **text** (non-greedy, single line)
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  // Bullet lists: lines starting with - or *
  text = text.replace(/^(?:- |\* )(.*)$/gm, '<li>$1</li>')
  // Lines that look like `Label: content` - split into heading + content with paragraph breaks preserved
  text = text.replace(/^([A-Z][A-Za-z\s]+):\s+(.+)$/gm, '<h5 class="mt-3 mb-1">$1</h5>\n<p>$2')
  // Wrap consecutive <li> blocks into <ul>
  text = text.replace(/(?:<li>[^<]*<\/li>\n?)+/g, (m) => `<ul>${m}\n</ul>`)
  // Paragraphs: double newlines
  text = text.replace(/\n\n+/g, '</p>\n<p>')
  // Close any unclosed <p> tags
  text = text.replace(/<p>([^<]*?)(?=<(?:h[345]|ul|$))/g, '<p>$1</p>')
  return `<div>${text}</div>`
}

// Attempt to split narrative into panelized sections based on numbered headings like:
// 1. Opening Hook and Why Now:
function extractNarrativeSections(text: string): { header?: string; sections: { title: string; body: string }[] } {
  const src = (text || '').trim()
  const lines = src.split(/\r?\n/)
  // Header is first markdown heading or first non-empty line if it looks like a title
  const h3 = /^\s*#+\s+(.*)$/
  let header: string | undefined
  for (const l of lines) {
    const m = l.match(h3)
    if (m) { header = m[1].trim(); break }
    if (!header && l.trim().length > 0 && l.trim().length < 120) { header = l.trim(); break }
  }
  // Split by numbered sections like "1. Title:" possibly with **bold** and colon not necessarily at EOL
  const pattern = /(?:^|\n)\s*(?:\*\*)?\d+\.\s+([^:\n]+):\s*/g
  const sections: { title: string; body: string }[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const indices: { idx: number; title: string }[] = []
  while ((match = pattern.exec(src)) !== null) {
    // Strip markdown bold syntax from title
    const rawTitle = match[1].trim()
    const cleanTitle = rawTitle.replace(/^\*\*|\*\*$/g, '').trim()
    indices.push({ idx: match.index + match[0].length, title: cleanTitle })
  }
  if (indices.length === 0) return { header, sections: [] }
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].idx
    const end = i + 1 < indices.length ? indices[i+1].idx - (indices[i+1].title.length + 4) : src.length
    const body = src.substring(start, end).trim()
    sections.push({ title: indices[i].title, body })
  }
  return { header, sections }
}

function cleanSectionBody(body: string, title: string): string {
  const lines = (body || '').split(/\r?\n/)
  const cleaned: string[] = []
  const norm = (s: string) => s.replace(/\*+/g, '').replace(/[:\s]+$/,'').trim().toLowerCase()
  const titleNorm = norm(title)
  for (let i=0;i<lines.length;i++) {
    const l = lines[i]
    const trimmed = l.trim()
    // drop standalone numbers or bullets that are just residual section numbers
    if (/^\d+$/.test(trimmed)) continue
    // drop bold heading line that repeats the title
    if ((/^\*\*.*\*\*$/.test(trimmed) || /^#+\s+/.test(trimmed)) && norm(trimmed.replace(/^#+\s+/, '').replace(/^\*\*|\*\*$/g,'')) === titleNorm) {
      continue
    }
    cleaned.push(l)
  }
  return cleaned.join('\n')
}

// removed signal strength UI
function ScoreBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-white/70">{label}</span>
        <span className="text-ralph-cyan">{(v/10).toFixed(1)}/10</span>
      </div>
      <div className="h-2 rounded bg-white/10 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-ralph-cyan to-ralph-pink" style={{ width: `${v}%` }} />
      </div>
    </div>
  )
}

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

  const [wildIdeas, setWildIdeas] = useState<any[] | null>(null)
  const [wildSources, setWildSources] = useState<string[] | null>(null)
  const [wildLoading, setWildLoading] = useState<boolean>(false)

  const [conceptOverview, setConceptOverview] = useState<string | null>(null)
  const [overviewLoading, setOverviewLoading] = useState<boolean>(false)
  const [showUnderHood, setShowUnderHood] = useState<boolean>(false)

  // Track if we've already positioned scoring/narrative nodes to prevent repositioning on re-render
  const nodesPositionedRef = useRef(false)

  // Target audience (separate from persona which is the user's role)
  const [targetAudience, setTargetAudience] = useState<string>(() => {
    try { return localStorage.getItem('targetAudience') || '' } catch { return '' }
  })

  // Track previous persona for auto-refresh on change
  const prevPersonaRef = useRef<string | null>(null)

  function focusBrief() {
    setNodes(prev => {
      const maxZ = prev.reduce((m, p) => Math.max(m, p.zIndex), 0)
      return prev.map(n => n.id === 'brief-input'
        ? { ...n, minimized: false, status: 'active' as NodeData['status'], zIndex: maxZ + 1 }
        : n)
    })
    try { document.getElementById('dashboard-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch {}
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
        api.debrief(concept, { persona, region, projectId: projectId || undefined, targetAudience }),
        api.opportunities(concept, { persona, region, projectId: projectId || undefined, targetAudience })
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
        setNarrativeRefreshRequested(true)
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
  // Scores and enhancements
  const [scores, setScores] = useState<{ narrative?: number; ttpWeeks?: number; cross?: number; commercial?: number; overall?: number } | null>(null)
  const [enhancements, setEnhancements] = useState<{ text: string; target?: string; deltas?: { narrative?: number; ttp?: number; cross?: number; commercial?: number } }[]>([])
  const [selectedEnhancements, setSelectedEnhancements] = useState<Set<number>>(new Set())
  const [scoringError, setScoringError] = useState<string | null>(null)
  const [conceptCreators, setConceptCreators] = useState<any[]>([])

  // Track if nodes have been stacked to avoid infinite loops
  const [nodesStacked, setNodesStacked] = useState(false)
  // Narrative refresh + in-flight tracking
  const [narrativeRefreshRequested, setNarrativeRefreshRequested] = useState(false)
  const debriefRefreshInFlight = useRef(false)
  const narrativeInFlight = useRef(false)

  // Narrative cache scoping: track signature of selection+persona+region to avoid stale rehydrate
  const selectionSig = JSON.stringify({
    sel: Array.from(selectedOpportunities).sort(),
    persona,
    region,
  })

  // Initialize nodes with smart auto-layout
  useEffect(() => {
    const initialNodes: NodeData[] = [
      {
        id: 'brief-input',
        type: 'input',
        title: 'What story are you telling?',
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
        title: 'Additional Context',
        x: 50,
        y: 400,
        width: 400,
        height: 140,
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
          api.debrief(concept, { persona, region, projectId: projectId || undefined, targetAudience }),
          api.opportunities(concept, { persona, region, projectId: projectId || undefined, targetAudience })
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
            n.id === 'debrief-opportunities' ? { ...n, status: (insufficient ? 'active' : 'complete') as NodeData['status'] } : n
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

  // Auto re-run when persona changes after initial analysis
  useEffect(() => {
    if (!activated || !concept) return
    if (prevPersonaRef.current === null) { prevPersonaRef.current = persona || ''; return }
    if (persona === prevPersonaRef.current) return
    prevPersonaRef.current = persona || ''
    ;(async () => {
      try {
        setNodes(prev => prev.map(n => n.id === 'debrief-opportunities' ? { ...n, status: 'processing' as const } : n))
        const pid = (() => { try { return localStorage.getItem('activeProjectId') || undefined } catch { return undefined } })()
        const [d, o] = await Promise.all([
          api.debrief(concept, { persona, region, projectId: pid, targetAudience }),
          api.opportunities(concept, { persona, region, projectId: pid, targetAudience })
        ])
        setDebrief(d); setOpps(o)
        try { if (pid) localStorage.setItem(`debrief:${pid}`, JSON.stringify(d)) } catch {}
        try { if (pid) localStorage.setItem(`opps:${pid}`, JSON.stringify(o)) } catch {}
        setNodes(prev => prev.map(n => n.id === 'debrief-opportunities' ? { ...n, status: 'complete' as const } : n))
        // Refresh Concept Overview if present
        if (nodes.find(n => n.id === 'concept-overview')) {
          setOverviewLoading(true)
          try {
            const result = await api.conceptOverview(concept, {
              persona,
              region,
              debrief: d?.brief,
              opportunities: o?.opportunities,
              narrative: narrative?.text,
              enhancements: [],
              projectId: pid,
              targetAudience
            })
            setConceptOverview(result?.overview || null)
            addActivity('Concept Overview updated', 'ai')
          } catch (e) { console.error('[PersonaSwitch] Overview refresh failed:', e) }
          finally { setOverviewLoading(false) }
        }
      } catch (e) {
        console.error('[PersonaSwitch] Re-evaluation failed:', e)
        setNodes(prev => prev.map(n => n.id === 'debrief-opportunities' ? { ...n, status: 'active' as const } : n))
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona])

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
        { id: 'gwi', type: 'integration', title: 'GWI (inactive)', x: 50, y: 800, width: 260, height: 80, minimized: false, zIndex: 1, status: 'idle' as const },
        { id: 'glimpse', type: 'integration', title: 'GLIMPSE (inactive)', x: 50, y: 900, width: 260, height: 80, minimized: false, zIndex: 1, status: 'idle' as const },
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

  const hasNarrativeNode = nodes.some(n => n.id === 'narrative')

  // Generate narrative with selected opportunities
  useEffect(() => {
    let cancel = false

    // Early return conditions with logging
    if (!debriefAccepted) {
      console.log('[Narrative] Waiting for debrief acceptance')
      return
    }
    if (!hasNarrativeNode) {
      console.log('[Narrative] Waiting for narrative node to be created')
      return
    }
    if (narrativeInFlight.current) return
    if (narrative && !narrativeLoading && !narrativeRefreshRequested) {
      console.log('[Narrative] Narrative already exists')
      return
    }

    console.log('[Narrative] Starting narrative generation...')
    narrativeInFlight.current = true
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
            const key = `nf:${pid}:${selectionSig}`
            localStorage.setItem('nfkey:'+pid, key)
            localStorage.setItem(key, JSON.stringify(blocks))
          } catch {}
          // Save narrative snapshot to project DB version history
          try {
            const pid = localStorage.getItem('activeProjectId')
            if (ENABLE_REMOTE_SAVE && pid && /^[0-9a-f\-]{36}$/i.test(pid)) {
              await api.saveVersion(pid, { summary: concept, narrative: (narrativeResult as any).text || '', changeSummary: 'Narrative generated' })
            }
          } catch {}
          // Mark narrative node as complete
          setNodes(prev => prev.map(n => n.id === 'narrative' ? { ...n, status: 'complete' as NodeData['status'] } : n))
          console.log('[Narrative] Generation complete')
          addActivity('Narrative structure ready', 'ai')
        }
      } catch (err) {
        console.error('[Narrative] Failed to generate narrative:', err)
        if (!cancel) {
          setNarrativeLoading(false)
          setNarrativeRefreshRequested(false)
        }
        addActivity('Narrative generation failed — try again', 'ai')
      } finally {
        narrativeInFlight.current = false
      }
    })()

    return () => { cancel = true; console.log('[Narrative] Effect cleanup (cancelled in-flight:', narrativeInFlight.current, ')') }
  }, [debriefAccepted, hasNarrativeNode, narrativeRefreshRequested])

  // Rehydrate narrative from cache as a failsafe (if API succeeded but UI missed state set)
  useEffect(() => {
    if (!debriefAccepted) return
    const pid = (() => { try { return localStorage.getItem('activeProjectId') || 'local' } catch { return 'local' } })()
    if (narrativeLoading) return
    if (narrative) return
    // Only rehydrate when we have a matching selection signature key and no in-flight generation
    if (narrativeInFlight.current) return
    try {
      const key = localStorage.getItem('nfkey:'+pid)
      if (!key || !key.endsWith(selectionSig)) return
      const blocks = JSON.parse(localStorage.getItem(key) || 'null') as any[] | null
      if (blocks && Array.isArray(blocks) && blocks.length) {
        const text = blocks.map(b => (b && (b.content || b.text) || '')).filter(Boolean).join('\n\n')
        if (text && text.length > 0) {
          console.log('[Narrative] Rehydrating from cache for pid', pid)
          setNarrative({ text })
          setNodes(prev => prev.map(n => n.id === 'narrative' ? { ...n, status: 'complete' as NodeData['status'] } : n))
        }
      }
    } catch {}
  }, [debriefAccepted, narrativeLoading, narrative, nodes.some(n => n.id === 'narrative'), selectionSig])

  // Step 3: Add Scoring & Enhancements ONLY after narrative is approved
  useEffect(() => {
    if (!narrativeApproved || nodes.find(n => n.id === 'scoring')) return
    // Add scoring and tidy/minimize to ensure in‑view
    setNodes(prev => {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1800
      const margin = 40
      const scoringWidth = 450
      const scoringX = Math.max(700, Math.min(1200, vw - scoringWidth - margin))
      const updated = prev.map(n => {
        if (n.id === 'debrief-opportunities') return { ...n, minimized: true }
        if (n.id === 'narrative') return { ...n, minimized: true, x: Math.max(400, scoringX - 500), y: 100 }
        return n
      })
      return [
        ...updated,
        {
          id: 'scoring',
          type: 'ai-content',
          title: 'Scoring & Enhancements',
          x: scoringX,
          y: 100,
          width: scoringWidth,
          height: 550,
          minimized: false,
          zIndex: 5,
          status: 'processing' as NodeData['status'],
          connectedTo: ['narrative', 'rkb']
        }
      ]
    })
  }, [narrativeApproved, nodes])

  // Auto‑tidy when scoring appears and load data
  useEffect(() => {
    const scoring = nodes.find(n => n.id === 'scoring')
    const narr = nodes.find(n => n.id === 'narrative')
    if (!scoring || !narr) return

    // Only position nodes once on first appearance to prevent moving user-positioned nodes
    if (!nodesPositionedRef.current) {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1800
      const margin = 60
      const scoringWidth = 450
      const narrativeWidth = 450

      // Position scoring on right, narrative to its left, both within viewport
      const scoringX = Math.max(margin + narrativeWidth + margin, Math.min(vw - scoringWidth - margin, vw * 0.58))
      const narrativeX = Math.max(margin, scoringX - narrativeWidth - margin)

      setNodes(prev => prev.map(n => {
        if (n.id === 'narrative') return { ...n, x: narrativeX, y: 100 }
        if (n.id === 'scoring') return { ...n, x: scoringX, y: 100 }
        return n
      }))

      nodesPositionedRef.current = true
    }
    if (scoring.status === 'processing') {
      let cancel = false
      ;(async () => {
        try {
          const graph: any = { concept, persona, region, debrief: debrief?.brief }
          const [sc, eh] = await Promise.all([
            api.score(concept, graph, { persona, region }),
            api.enhancements(concept, graph, { persona, region })
          ])
          if (cancel) return
          setScores(sc || null)
          let list = Array.isArray(eh?.suggestions) ? eh.suggestions : []
          if (!list.length) {
            // Fallback suggestions if API returns nothing
            list = [
              { text: `Add YouTube Shorts component to amplify reach`, deltas: { narrative: 8, ttp: 3, cross: 2, commercial: 4 } },
              { text: `Integrate trending audio library for higher cultural relevance`, deltas: { narrative: 6, ttp: 2, cross: 3, commercial: 2 } },
              { text: `Extend to Snapchat Spotlight to diversify platforms`, deltas: { narrative: 3, ttp: 2, cross: 4, commercial: 1 } },
            ]
          }
          setEnhancements(list)
          setScoringError(null)
          setNodes(prev => prev.map(n => n.id === 'scoring' ? { ...n, status: 'active' as NodeData['status'] } : n))
          } catch (err) {
            if (!cancel) {
              // Do not fake scores; show unavailable state instead
              setScores(null)
              setEnhancements([
                { text: `Add YouTube Shorts component to amplify reach`, deltas: { narrative: 8, ttp: 3, cross: 2, commercial: 4 } },
                { text: `Integrate trending audio library for higher cultural relevance`, deltas: { narrative: 6, ttp: 2, cross: 3, commercial: 2 } },
                { text: `Extend to Snapchat Spotlight to diversify platforms`, deltas: { narrative: 3, ttp: 2, cross: 4, commercial: 1 } },
              ])
              setScoringError('Scores not available (fetch failed).')
              setNodes(prev => prev.map(n => n.id === 'scoring' ? { ...n, status: 'active' as NodeData['status'] } : n))
            }
          }
      })()
      return () => { cancel = true }
    }
  }, [nodes.find(n => n.id === 'scoring')?.status])

  // Removed old simulated Creative Partner node timer

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

  async function ensureConceptOverviewNode() {
    setNodes(prev => {
      const exists = prev.find(n => n.id === 'concept-overview')
      if (exists) return prev.map(n => n.id === 'concept-overview' ? { ...n, minimized: false, status: 'processing' as NodeData['status'] } : n)
      return [
        ...prev,
        {
          id: 'concept-overview',
          type: 'ai-content',
          title: 'Concept Overview',
          x: 1650,
          y: 100,
          width: 450,
          height: 260,
          minimized: false,
          zIndex: 6,
          status: 'processing' as NodeData['status'],
          connectedTo: ['scoring']
        }
      ]
    })
  }

  async function refreshConceptOverview(appliedEnhancements: string[] = []) {
    try {
      setOverviewLoading(true)
      await ensureConceptOverviewNode()
      const pid = (() => { try { return localStorage.getItem('activeProjectId') || undefined } catch { return undefined } })()
      const result = await api.conceptOverview(concept, {
        persona,
        region,
        debrief: debrief?.brief,
        opportunities: opps?.opportunities,
        narrative: narrative?.text,
        enhancements: appliedEnhancements,
        projectId: pid,
        targetAudience
      })
      setConceptOverview(result?.overview || null)
      try { if (pid) localStorage.setItem(`overview:${pid}`, JSON.stringify(result)) } catch {}
      setNodes(prev => prev.map(n => n.id === 'concept-overview' ? { ...n, status: 'active' as NodeData['status'] } : n))
    } catch (err) {
      console.error('[ConceptOverview] Failed:', err)
    } finally {
      setOverviewLoading(false)
    }
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
          setNodes(prev => prev.map(n => n.id === 'debrief-opportunities' ? { ...n, status: (insufficient ? 'active' : 'complete') as NodeData['status'] } : n))
          addActivity('Debrief updated with project context', 'ai')
          // If narrative was accepted previously, refresh it as well
          if (debriefAccepted) {
            setNodes(prev => prev.map(n => n.id === 'narrative' ? { ...n, status: 'processing' as const } : n))
            setNarrativeRefreshRequested(true)
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
            placeholder="Describe your brief, story concept or proposal vision and add any useful files or references below"
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
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => { setTargetAudience(e.target.value); try { localStorage.setItem('targetAudience', e.target.value) } catch {} }}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Target audience (optional, separate with commas)"
            className="w-full bg-charcoal-800/70 border border-white/10 rounded px-3 py-1.5 text-xs"
          />
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
          {/* Show uploaded files */}
          {processed.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1 max-h-20 overflow-auto">
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
                  {/* Removed signal strength UI per feedback */}
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

                {Array.isArray((debrief as any).personaNotes) && (debrief as any).personaNotes.length > 0 && (
                  <div className="mt-3">
                    <div className="text-white/60 font-medium mb-1 text-[10px]">Persona Notes</div>
                    <ul className="list-disc pl-4 space-y-1">
                      {(debrief as any).personaNotes.slice(0,2).map((p: string, i: number) => (
                        <li key={i} className="text-white/70 text-[10px]">{p}</li>
                      ))}
                    </ul>
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
            <BrandSpinner text="Composing narrative structure with selected opportunities…" />
          ) : (
            <>
              {/* Narrative Content (panelized) */}
              {(() => {
                const parsed = extractNarrativeSections(narrative.text || '')
                if (!parsed.sections.length) {
                  return (
                    <div className="panel p-3 bg-white/5">
                      <div className="text-white/70 font-medium mb-2 text-[11px]">NARRATIVE STRUCTURE</div>
                      <div className="prose prose-invert max-w-none text-[10px] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(narrative.text) }} />
                    </div>
                  )
                }
                return (
                  <div className="space-y-3">
                    {parsed.header && (
                      <div className="panel p-3 bg-white/5">
                        <div className="text-white/70 font-semibold mb-2 text-[11px]">{parsed.header}</div>
                      </div>
                    )}
                    {parsed.sections.map((sec, i) => (
                      <div key={i} className="panel p-3 bg-white/5">
                        <div className="text-white/80 font-medium mb-1 text-[11px]">{sec.title}</div>
                        <div className="prose prose-invert max-w-none text-[10px] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(cleanSectionBody(sec.body, sec.title)) }} />
                      </div>
                    ))}
                  </div>
                )
              })()}

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
            <BrandSpinner text="Calculating metrics and analyzing enhancements…" />
          ) : (
            <>
              <div className="panel p-2 bg-white/5">
                <div className="text-white/70 font-medium mb-2 text-[11px]">CAMPAIGN SCORING</div>
                {scoringError && (
                  <div className="mb-2 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded px-2 py-1">
                    {scoringError}
                  </div>
                )}
                <ScoreBar label="Cultural Relevance" value={scores?.narrative ?? 0} />
                <ScoreBar label="Engagement Potential" value={scores?.cross ?? 0} />
                <ScoreBar label="Platform Fit" value={scores?.ttpWeeks ? Math.max(0, 100 - (scores.ttpWeeks-1)*12) : 0} />
                <ScoreBar label="Commercial Viability" value={scores?.commercial ?? 0} />
              </div>

              <div className="panel p-2 bg-white/5">
                <div className="text-white/70 font-medium mb-2 text-[11px]">RECOMMENDED ENHANCEMENTS</div>
                <div className="space-y-2">
                  {enhancements.map((e, idx) => {
                    const checked = selectedEnhancements.has(idx)
                    return (
                      <label key={idx} className="flex items-start gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={checked}
                          onChange={(ev) => {
                            const set = new Set(selectedEnhancements)
                            if (ev.target.checked) set.add(idx); else set.delete(idx)
                            setSelectedEnhancements(set)
                          }}
                        />
                        <div>
                          <div className="text-white/70 text-[10px] group-hover:text-white/90">{e.text}</div>
                          {e.deltas && (
                            <div className="text-white/50 text-[9px]">Δ narrative {e.deltas.narrative ?? 0} · Δ ttp {e.deltas.ttp ?? 0} · Δ cross {e.deltas.cross ?? 0} · Δ commercial {e.deltas.commercial ?? 0}</div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
                <button
                  className="mt-3 w-full px-3 py-2 rounded bg-ralph-cyan/70 hover:bg-ralph-cyan text-xs font-medium"
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (!narrative) return
                    const applied = enhancements.filter((_, i) => selectedEnhancements.has(i)).map(a => a.text)
                    if (applied.length === 0) return
                    setNodes(prev => prev.map(n => n.id === 'scoring' ? { ...n, status: 'processing' as NodeData['status'] } : n))
                    try {
                      const pid = (() => { try { return localStorage.getItem('activeProjectId') || undefined } catch { return undefined } })()
                      const rewritten = await api.applyEnhancements(concept, narrative.text, applied, { persona, region, projectId: pid })
                      if (rewritten && rewritten.text) setNarrative({ text: rewritten.text })
                    } catch {
                      const extra = '\n\n---\n\nApplied Enhancements:\n' + applied.map(a => '- ' + a).join('\n')
                      setNarrative({ text: (narrative?.text || '') + extra })
                    }
                    try {
                      const graph: any = { concept, persona, region, debrief: debrief?.brief }
                      const sc = await api.score(concept, graph, { persona, region })
                      setScores(sc || null)
                    } catch {}
                    setNodes(prev => prev.map(n => n.id === 'scoring' ? { ...n, status: 'active' as NodeData['status'] } : n))

                    // Add Concept Overview and Creative Partner nodes
                    setNodes(prev => {
                      const next: NodeData[] = [...prev]
                      // Calculate viewport-aware positions to ensure nodes are visible
                      const viewportWidth = window.innerWidth
                      const viewportHeight = window.innerHeight
                      const nodeWidth = 450
                      // Position nodes in the right portion of viewport with padding
                      const baseX = Math.max(100, Math.min(viewportWidth - nodeWidth - 100, viewportWidth * 0.55))

                      if (!prev.find(n => n.id === 'concept-overview')) {
                        next.push({
                          id: 'concept-overview',
                          type: 'ai-content',
                          title: 'Concept Overview',
                          x: baseX,
                          y: 100,
                          width: nodeWidth,
                          height: 260,
                          minimized: false,
                          zIndex: 6,
                          status: 'processing' as NodeData['status'],
                          connectedTo: ['scoring']
                        })
                      }
                      if (!prev.find(n => n.id === 'creative-partner')) {
                        next.push({
                          id: 'creative-partner',
                          type: 'ai-content',
                          title: 'Need a Creative Partner?',
                          x: baseX,
                          y: 380,
                          width: nodeWidth,
                          height: 340,
                          minimized: true,
                          zIndex: 6,
                          status: 'processing' as NodeData['status'],
                          connectedTo: ['scoring']
                        })
                      }
                      return next
                    })

                    // Generate concept overview
                    try {
                      setOverviewLoading(true)
                      const pid = (() => { try { return localStorage.getItem('activeProjectId') || undefined } catch { return undefined } })()
                      const appliedEnhancements = Array.from(selectedEnhancements).map(idx => enhancements[idx]?.text).filter(Boolean)
                      const result = await api.conceptOverview(concept, {
                        persona,
                        region,
                        debrief: debrief?.brief,
                        opportunities: opps?.opportunities,
                        narrative: narrative?.text,
                        enhancements: appliedEnhancements,
                        projectId: pid,
                        targetAudience
                      })
                      setConceptOverview(result?.overview || null)
                      addActivity('Concept Overview created', 'ai')
                      console.log('[ConceptOverview] Generated:', result?.overview)
                    } catch (err) {
                      console.error('[ConceptOverview] Failed:', err)
                      setConceptOverview(null)
                    } finally {
                      setOverviewLoading(false)
                    }

                    // Fetch creators
                    try {
                      const rec = await api.recommendations(concept, { nodes: [], links: [] }, { persona, region, targetAudience })
                      const creators = Array.isArray((rec as any)?.creators) ? (rec as any).creators : []
                      setConceptCreators(creators)
                      // Build Concept Overview if none
                      if (!conceptOverview) {
                        try {
                          const parts: string[] = []
                          const essence = debrief?.brief || ''
                          if (essence) parts.push(`### Campaign Essence\n\n${essence}`)
                          const strat = Array.isArray((rec as any)?.narrative) ? (rec as any).narrative.slice(0,3) : []
                          if (strat.length) parts.push(`### Strategic Approach\n\n` + strat.map((s: string) => `- ${s}`).join('\n'))
                          const exec = Array.isArray((rec as any)?.content) ? (rec as any).content.slice(0,3) : []
                          if (exec.length) parts.push(`### Execution Highlights\n\n` + exec.map((s: string) => `- ${s}`).join('\n'))
                          const next = Array.isArray((rec as any)?.platform) ? (rec as any).platform.slice(0,3) : []
                          if (next.length) parts.push(`### Next Steps\n\n` + next.map((s: string) => `- ${s}`).join('\n'))
                          if (parts.length) setConceptOverview(parts.join('\n\n'))
                        } catch {}
                      }
                    } catch (err) {
                      console.error('[Creators] API failed:', err)
                      setConceptCreators([])
                    }

                    setNodes(prev => prev.map(n => (n.id === 'concept-overview' || n.id === 'creative-partner') ? { ...n, status: 'active' as NodeData['status'] } : n))
                  }}
                >
                  Apply Enhancements
                </button>
                <button
                  className="mt-2 w-full px-3 py-2 rounded border border-yellow-400/40 bg-yellow-400/10 hover:bg-yellow-400/20 text-xs font-medium"
                  onClick={async (e) => {
                    e.stopPropagation()
                    // spawn wildcard node minimized
                    setNodes(prev => {
                      if (prev.find(n => n.id === 'wildcard')) return prev.map(n => n.id === 'wildcard' ? { ...n, minimized: true, status: 'processing' as NodeData['status'] } : n)

                      // Calculate viewport-aware position
                      const vw = typeof window !== 'undefined' ? window.innerWidth : 1800
                      const vh = typeof window !== 'undefined' ? window.innerHeight : 1000
                      const nodeWidth = 450
                      const nodeHeight = 360
                      const margin = 60
                      const wildcardX = Math.max(margin, Math.min(vw - nodeWidth - margin, vw * 0.58))
                      const wildcardY = Math.max(margin, Math.min(vh - nodeHeight - margin, 400))

                      return [
                        ...prev,
                        {
                          id: 'wildcard',
                          type: 'wildcard',
                          title: 'Wildcard Insight',
                          x: wildcardX,
                          y: wildcardY,
                          width: nodeWidth,
                          height: nodeHeight,
                          minimized: true,
                          zIndex: 6,
                          status: 'processing' as NodeData['status'],
                          connectedTo: ['scoring', 'rkb']
                        }
                      ]
                    })
                    try {
                      setWildLoading(true)
                      const pid = (() => { try { return localStorage.getItem('activeProjectId') || undefined } catch { return undefined } })()
                      const baseline = [debrief?.brief || '', narrative?.text || ''].filter(Boolean).join('\n\n')
                      const resp = await api.wildcard(concept, { persona, region, projectId: pid, baseline })
                      const ideas = Array.isArray(resp?.ideas) ? resp.ideas : []
                      const sources = Array.isArray((resp as any)?.sourcesUsed) ? (resp as any).sourcesUsed : []
                      setWildIdeas(ideas)
                      setWildSources(sources)
                      try { if (pid) localStorage.setItem(`wild:${pid}`, JSON.stringify({ ts: Date.now(), ...resp })) } catch {}
                      setNodes(prev => prev.map(n => n.id === 'wildcard' ? { ...n, minimized: false, status: 'active' as NodeData['status'] } : n))
                      addActivity('Rolled Wildcard insight', 'ai')
                    } catch (err) {
                      setWildIdeas([])
                      setNodes(prev => prev.map(n => n.id === 'wildcard' ? { ...n, minimized: false, status: 'active' as NodeData['status'] } : n))
                    } finally {
                      setWildLoading(false)
                    }
                  }}
                >
                  Roll Wildcard
                </button>
              </div>
            </>
          )}
        </div>
      )
    }

    if (node.id === 'concept-overview') {
      return (
        <div className="space-y-3 text-xs max-h-full overflow-auto">
          {(node.status === 'processing' || overviewLoading) ? (
            <BrandSpinner text="Synthesizing final overview…" />
          ) : conceptOverview ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="text-white/70 font-medium text-[11px]">CONCEPT OVERVIEW</div>
                <button
                  className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                  onClick={async (e) => {
                    e.stopPropagation()
                    try {
                      setOverviewLoading(true)
                      const pid = (() => { try { return localStorage.getItem('activeProjectId') || undefined } catch { return undefined } })()
                      const appliedEnhancements = Array.from(selectedEnhancements).map(idx => enhancements[idx]?.text).filter(Boolean)
                      const result = await api.conceptOverview(concept, {
                        persona,
                        region,
                        debrief: debrief?.brief,
                        opportunities: opps?.opportunities,
                        narrative: narrative?.text,
                        enhancements: appliedEnhancements,
                        projectId: pid,
                        targetAudience
                      })
                      setConceptOverview(result?.overview || null)
                      addActivity('Concept Overview refreshed', 'ai')
                    } catch (err) {
                      console.error('[ConceptOverview] Refresh failed:', err)
                    } finally {
                      setOverviewLoading(false)
                    }
                  }}
                >Refresh</button>
              </div>
              {/* Parse and display sections like narrative node */}
              {(() => {
                const parsed = extractNarrativeSections(conceptOverview || '')
                if (!parsed.sections.length) {
                  return (
                    <div className="panel p-3 bg-white/5">
                      <div className="prose prose-invert max-w-none text-[10px] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(conceptOverview) }} />
                    </div>
                  )
                }
                return (
                  <div className="space-y-2">
                    {parsed.header && (
                      <div className="panel p-3 bg-white/5">
                        <div className="text-white/70 font-semibold text-[11px]">{parsed.header}</div>
                      </div>
                    )}
                    {parsed.sections.map((sec, i) => (
                      <div key={i} className="panel p-3 bg-white/5">
                        <div className="text-white/80 font-medium mb-1.5 text-[11px]">{sec.title}</div>
                        <div className="prose prose-invert max-w-none text-[10px] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(cleanSectionBody(sec.body, sec.title)) }} />
                      </div>
                    ))}
                  </div>
                )
              })()}
            </>
          ) : (
            <div className="text-white/50 text-[11px]">
              Click "Apply Enhancements" to generate the final concept overview.
            </div>
          )}
        </div>
      )
    }

    if (node.id === 'wildcard') {
      return (
        <div className="space-y-3 text-xs max-h-full overflow-auto">
          {node.status === 'processing' || wildLoading ? (
            <BrandSpinner text="Hunting for contrarian insight…" />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-white/70 font-medium text-[11px]">WILDCARD INSIGHT</div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        setWildLoading(true)
                        const pid = (() => { try { return localStorage.getItem('activeProjectId') || undefined } catch { return undefined } })()
                        const baseline = [debrief?.brief || '', narrative?.text || ''].filter(Boolean).join('\n\n')
                        const resp = await api.wildcard(concept, { persona, region, projectId: pid, baseline })
                        const ideas = Array.isArray(resp?.ideas) ? resp.ideas : []
                        const sources = Array.isArray((resp as any)?.sourcesUsed) ? (resp as any).sourcesUsed : []
                        setWildIdeas(ideas)
                        setWildSources(sources)
                        try { if (pid) localStorage.setItem(`wild:${pid}`, JSON.stringify({ ts: Date.now(), ...resp })) } catch {}
                        addActivity('Regenerated Wildcard insight', 'ai')
                      } catch {
                        setWildIdeas([])
                      } finally {
                        setWildLoading(false)
                      }
                    }}
                  >Regenerate</button>
                </div>
              </div>
              {(Array.isArray(wildIdeas) && wildIdeas.length > 0) ? (
                <div className="space-y-3">
                  {wildIdeas.map((idea: any, idx: number) => (
                    <div key={idx} className="panel p-2 bg-white/5">
                      <div className="text-white/90 text-[11px] font-medium mb-1">{idea.title || 'Idea'}</div>
                      {Array.isArray(idea.contrarianWhy) && idea.contrarianWhy.length > 0 && (
                        <div className="mb-1">
                          <div className="text-white/60 text-[10px] mb-0.5">Why Contrarian</div>
                          <ul className="list-disc pl-4 text-[10px] text-white/80">
                            {idea.contrarianWhy.map((w: string, i: number) => <li key={i}>{w}</li>)}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(idea.evidence) && idea.evidence.length > 0 && (
                        <div className="mb-1">
                          <div className="text-white/60 text-[10px] mb-0.5">Evidence</div>
                          <div className="flex flex-wrap gap-1">
                            {idea.evidence.map((ev: string, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-yellow-400/10 border border-yellow-400/40 text-[10px]">{ev}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {idea.upside && (
                        <div className="text-white/80 text-[10px] mb-1"><span className="text-white/60">Potential Upside:</span> {idea.upside}</div>
                      )}
                      {Array.isArray(idea.risks) && idea.risks.length > 0 && (
                        <div className="mb-1">
                          <div className="text-white/60 text-[10px] mb-0.5">Risks / Failure Modes</div>
                          <ul className="list-disc pl-4 text-[10px] text-white/80">
                            {idea.risks.map((r: string, i: number) => <li key={i}>{r.replace(/^['"]|['"]$/g,'')}</li>)}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(idea.testPlan) && idea.testPlan.length > 0 && (
                        <div className="mb-1">
                          <div className="text-white/60 text-[10px] mb-0.5">How to Test This Week</div>
                          <ul className="list-disc pl-4 text-[10px] text-white/80">
                            {idea.testPlan.map((t: string, i: number) => <li key={i}>{t.replace(/^['"]|['"]$/g,'')}</li>)}
                          </ul>
                        </div>
                      )}
                      {idea.firstStep && (
                        <div className="text-white/80 text-[10px]"><span className="text-white/60">First Step:</span> {idea.firstStep}</div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          className="text-[10px] px-2 py-0.5 rounded bg-yellow-400/70 hover:bg-yellow-400 text-black"
                          onClick={() => {
                            // append a Wildcard Track to narrative
                            const block = `\n\n---\n\nWildcard Track: ${idea.title}\n\nWhy Contrarian:\n- ${(idea.contrarianWhy||[]).join('\n- ')}\n\nTest Plan:\n- ${(idea.testPlan||[]).join('\n- ')}\n\nFirst Step: ${idea.firstStep || ''}`
                            const current = narrative?.text || ''
                            const updated = current + block
                            setNodes(prev => prev.map(n => n.id === 'wildcard' ? { ...n, status: 'processing' as NodeData['status'] } : n))
                            try { setNarrative({ text: updated }) } catch {}
                            // Refresh concept overview when narrative changes via wildcard
                            try { refreshConceptOverview([]) } catch {}
                            setTimeout(() => setNodes(prev => prev.map(n => n.id === 'wildcard' ? { ...n, status: 'active' as NodeData['status'] } : n)), 400)
                            addActivity('Applied Wildcard to narrative', 'ai')
                          }}
                        >Apply to Narrative</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-white/50 text-[11px]">No wildcard ideas available.</div>
              )}
              {Array.isArray(wildSources) && wildSources.length > 0 && (
                <div className="text-[10px] text-white/50">Sources used: {wildSources.join(', ')}</div>
              )}
            </>
          )}
        </div>
      )
    }
    if (node.id === 'creative-partner') {
      return (
        <div className="space-y-3 text-xs max-h-full overflow-auto">
          {Array.isArray(conceptCreators) && conceptCreators.length > 0 ? (
            conceptCreators.slice(0,8).map((c: any, i: number) => {
              const followers = c.followers || c.metrics?.followers || c.stats?.followers
              const engagement = c.engagement || c.metrics?.engagementRate || c.stats?.engagement
              const tags: string[] = Array.isArray(c.tags) ? c.tags : Array.isArray(c.metadata?.tags) ? c.metadata.tags : []
              return (
                <div key={i} className="panel p-2 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="text-white/80 text-[11px] font-medium">{c.name || c.handle || 'Creator'}</div>
                    <div className="text-white/50 text-[9px]">{c.platform || ''}{c.category?` • ${c.category}`:''}</div>
                  </div>
                  <div className="mt-1 text-white/60 text-[10px]">
                    {followers ? <span>{new Intl.NumberFormat().format(followers)} followers</span> : <span />}
                    {engagement ? <span className="ml-2">{typeof engagement==='number'?`${engagement}%`:`${engagement}` } engagement</span> : null}
                  </div>
                  {tags && tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tags.slice(0,6).map((t, j) => <span key={j} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px]">{t}</span>)}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="text-white/60 text-[10px]">No recommendations available.</div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div className="relative w-full h-screen">
      {/* Export Button */}
      <div className="absolute top-3 right-4 z-50">
        <button
          className="px-3 py-1.5 rounded border border-white/10 bg-white/10 hover:bg-white/20 text-xs"
          onClick={() => {
            const conceptName = (concept || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
            const md = exportProjectFull(concept || 'Untitled', persona || '', region || '')
            const ts = new Date().toISOString().replace(/[:.]/g, '-')
            downloadMarkdown(md, `${conceptName || 'project'}-${ts}.md`)
          }}
        >
          Export Project
        </button>
        <button
          className="ml-2 px-3 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-xs"
          onClick={() => setShowUnderHood(true)}
        >
          Under the Hood
        </button>
      </div>
      {/* Canvas with Nodes */}
      <Canvas nodes={nodes} onNodesChange={setNodes} renderNodeContent={renderNodeContent} />

      {/* Floating assistant removed per new UX */}

      {/* Under the Hood Overlay */}
      {showUnderHood && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowUnderHood(false)}>
          <div className="w-[900px] max-h-[80vh] overflow-auto bg-charcoal-900 border border-white/10 rounded-lg p-4 text-xs text-white/80" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-white/90 font-medium">Under the Hood</div>
              <button className="px-2 py-1 rounded border border-white/10 bg-white/10 hover:bg-white/20" onClick={()=>setShowUnderHood(false)}>Close</button>
            </div>
            {renderUnderHood()}
          </div>
        </div>
      )}
    </div>
  )
}

function readLS(key: string) { try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null } }

function linkList(arr?: any[]) {
  if (!Array.isArray(arr) || !arr.length) return <span className="text-white/40">—</span>
  return (
    <ul className="list-disc pl-4 space-y-0.5">
      {arr.map((x, i) => <li key={i}>{String(x)}</li>)}
    </ul>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-3 bg-white/5 border border-white/10 mb-2">
      <div className="text-white/70 font-medium mb-1">{title}</div>
      {children}
    </div>
  )
}

function renderUnderHood() {
  const pid = (() => { try { return localStorage.getItem('activeProjectId') || 'local' } catch { return 'local' } })()
  const concept = localStorage.getItem('concept') || ''
  const persona = localStorage.getItem('persona') || ''
  const region = localStorage.getItem('region') || ''
  const audience = localStorage.getItem('targetAudience') || ''
  const debrief = readLS(`debrief:${pid}`)
  const opps = readLS(`opps:${pid}`)
  const recs = readLS(`recs:${pid}`)
  const wild = readLS(`wild:${pid}`)
  const overview = readLS(`overview:${pid}`)

  return (
    <div>
      <Section title="Project">
        <div>Concept: {concept || <span className="text-white/40">—</span>}</div>
        <div>Persona: {persona || <span className="text-white/40">—</span>} • Region: {region || <span className="text-white/40">—</span>} • Audience: {audience || <span className="text-white/40">—</span>}</div>
      </Section>

      <Section title="Debrief Sources (used in Debrief)">
        <div className="grid md:grid-cols-3 gap-3">
          <div><div className="text-white/60 mb-1">Project Files</div>{linkList(debrief?.sources?.project)}</div>
          <div><div className="text-white/60 mb-1">RKB</div>{linkList(debrief?.sources?.core)}</div>
          <div><div className="text-white/60 mb-1">Live Trends</div>{linkList(debrief?.sources?.live)}</div>
        </div>
      </Section>

      <Section title="Opportunities Sources (used in Opportunities)">
        <div className="grid md:grid-cols-3 gap-3">
          <div><div className="text-white/60 mb-1">Project Files</div>{linkList(opps?.sources?.project)}</div>
          <div><div className="text-white/60 mb-1">RKB</div>{linkList(opps?.sources?.core)}</div>
          <div><div className="text-white/60 mb-1">Live Trends</div>{linkList(opps?.sources?.live)}</div>
        </div>
      </Section>

      <Section title="Recommendations Sources (used in Recommendations)">
        <div className="grid md:grid-cols-3 gap-3">
          <div><div className="text-white/60 mb-1">Project Files</div>{linkList(recs?.sources?.project)}</div>
          <div><div className="text-white/60 mb-1">RKB</div>{linkList(recs?.sources?.core)}</div>
          <div><div className="text-white/60 mb-1">Live Trends</div>{linkList(recs?.sources?.live)}</div>
        </div>
      </Section>

      <Section title="Wildcard Evidence">
        {Array.isArray(wild?.ideas) && wild.ideas.length ? (
          <div className="space-y-2">
            {wild.ideas.map((idea: any, i: number) => (
              <div key={i} className="p-2 bg-white/5 rounded border border-white/10">
                <div className="text-white/80 font-medium">{idea.title}</div>
                <div className="mt-1 text-white/60">Evidence: {Array.isArray(idea.evidence)?idea.evidence.join(', '):'—'}</div>
              </div>
            ))}
          </div>
        ) : <div className="text-white/40">—</div>}
      </Section>

      <Section title="Prompts (latest run)">
        <div className="space-y-2">
          {debrief?._debug?.prompt && (
            <details><summary className="cursor-pointer text-white/70">Debrief Prompt</summary><pre className="mt-1 whitespace-pre-wrap text-white/60">{debrief._debug.prompt}</pre></details>
          )}
          {opps?._debug?.prompt && (
            <details><summary className="cursor-pointer text-white/70">Opportunities Prompt</summary><pre className="mt-1 whitespace-pre-wrap text-white/60">{opps._debug.prompt}</pre></details>
          )}
          {recs?._debug?.prompt && (
            <details><summary className="cursor-pointer text-white/70">Recommendations Prompt</summary><pre className="mt-1 whitespace-pre-wrap text-white/60">{recs._debug.prompt}</pre></details>
          )}
          {wild?._debug?.prompt && (
            <details><summary className="cursor-pointer text-white/70">Wildcard Prompt</summary><pre className="mt-1 whitespace-pre-wrap text-white/60">{wild._debug.prompt}</pre></details>
          )}
        </div>
      </Section>
    </div>
  )
}
