import { useEffect, useMemo, useState } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { CitationToken } from '../shared/CitationOverlay'
import { useCreators } from '../../context/CreatorContext'
import { api } from '../../services/api'
import LoadingSpinner from '../Common/LoadingSpinner'

type Block = { id: string; key: string; title: string; content: string }

export default function ConceptCreators() {
  const { concept, persona, region } = useDashboard() as any
  const { recommended } = useCreators()
  const [blocks, setBlocks] = useState<Block[]>([])
  const [aiProposal, setAiProposal] = useState<string | null>(null)
  const [loadingProposal, setLoadingProposal] = useState(false)

  const projectId = useMemo(() => { try { return localStorage.getItem('activeProjectId') || 'local' } catch { return 'local' } }, [])
  const storageKey = `nf:${projectId}`

  useEffect(() => {
    try { const raw = localStorage.getItem(storageKey); if (raw) setBlocks(JSON.parse(raw)) } catch {}
  }, [storageKey, concept])

  // Generate AI proposal when concept or creators change
  useEffect(() => {
    let cancel = false
    if (!concept || !recommended.length || !blocks.length) return

    setLoadingProposal(true)
    ;(async () => {
      try {
        const narrativeBlocks = blocks.map(b => ({ key: b.key, content: b.content }))
        const creators = recommended.slice(0, 3).map(c => ({
          name: c.name,
          platform: c.platform,
          category: c.category,
          tags: c.tags
        }))

        const result = await api.conceptProposal(concept, narrativeBlocks, creators, { persona, projectId })
        if (!cancel) {
          setAiProposal(result.narrative)
        }
      } catch (err) {
        console.error('Failed to generate concept proposal:', err)
        if (!cancel) {
          // Fallback to synthesized version
          setAiProposal(null)
        }
      } finally {
        if (!cancel) setLoadingProposal(false)
      }
    })()

    return () => { cancel = true }
  }, [concept, recommended, blocks, persona, projectId])

  const refined = useMemo(() => synthesizeRefined(concept, blocks), [concept, blocks])
  const top = (recommended || []).slice(0, 3)

  return (
    <div className="panel module p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">CONCEPT + CREATORS</div>
        <div className="text-xs text-white/60">Shareable concept proposal</div>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {loadingProposal && (
            <LoadingSpinner text="Crafting shareable campaign proposal with creator recommendations…" />
          )}
          {!loadingProposal && (
            <>
              <div className="text-white/90 font-medium">{refined.oneLiner}</div>
              {aiProposal ? (
                <div className="mt-3 text-sm text-white/80 leading-relaxed">{aiProposal}</div>
              ) : (
                <>
                  <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
                    {refined.bullets.map((b, i) => {
                      // Add citation token for trend line if present
                      const isTrendLine = b.startsWith('Top vectors:')
                      const trendNames = isTrendLine ? b.replace('Top vectors:','').split(',').map(s => s.trim()).filter(Boolean) : []
                      let token: JSX.Element | null = null
                      if (isTrendLine && trendNames.length) {
                        try {
                          const id = (window as any).__registerCitation?.('Trends', `Top vectors referenced: ${trendNames.join(', ')}`)
                          if (id) token = <span className="ml-1 align-middle"><CitationToken id={id} label={'Trends'} detail={`Top vectors referenced: ${trendNames.join(', ')}`} /></span>
                        } catch {}
                      }
                      return <li key={i} className="text-white/80">{b} {token}</li>
                    })}
                  </ul>
                  {refined.proposal && (
                    <div className="mt-3 text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{refined.proposal}</div>
                  )}
                </>
              )}
              <div className="mt-2 text-[11px] text-white/60">
                <button onClick={() => { try { window.dispatchEvent(new CustomEvent('open-citation', { detail: { id: 'all' } })) } catch {} }} className="underline hover:text-white/80">View all citations</button>
              </div>
            </>
          )}
        </div>
        <div>
          <div className="text-xs text-white/60 mb-1">Need a Creative Partner?</div>
          <div className="text-[11px] text-white/50 mb-2">Here are some top matches for this project.</div>
          <div className="space-y-2">
            {top.map((c) => (
              <div key={c.id} className="panel p-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[10px] text-white/60">{c.platform}</div>
                </div>
                <div className="text-[11px] text-white/60">{c.category}</div>
                <div className="text-[11px] text-white/50 mt-1">
                  Why: {explainWhy(c.tags)}{' '}
                  {(() => {
                    try {
                      const id = (window as any).__registerCitation?.(`Creator: ${c.name}`, `Suggested creator match: ${c.name} (${c.platform} • ${c.category})`)
                      return id ? <CitationToken id={id} label={`Creator: ${c.name}`} detail={`Suggested creator match: ${c.name} (${c.platform} • ${c.category})`} /> : null
                    } catch { return null }
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function synthesizeRefined(concept: string, blocks: Block[]) {
  const byKey = (k: string) => blocks.find(b => b.key === k)?.content?.trim() || ''
  const hook = byKey('hook')
  const premise = byKey('origin') || concept
  const arc = byKey('arc')
  const pivot = byKey('pivots')
  const evidence = byKey('evidence')
  const resolution = byKey('resolution')
  const oneLiner = hook || concept
  const pid = localStorage.getItem('activeProjectId') || 'local'
  let deb: any = null
  let trends: string[] = []
  try { deb = JSON.parse(localStorage.getItem(`debrief:${pid}`) || 'null') } catch {}
  try {
    const sources = deb?.sources || {}
    const core = (sources.core || []) as string[]
    trends = core.filter((s: string) => s.startsWith('trend:')).map((s: string) => s.replace('trend:', '')).slice(0,2)
  } catch {}
  const extra = deb?.summary ? [`Summary: ${deb.summary}`] : []
  const trendLine = trends.length ? [`Top vectors: ${trends.join(', ')}`] : []
  const bullets = [...extra, ...trendLine, pivot, evidence, resolution].filter(Boolean).slice(0,3)

  // Build a proper narrative proposal (avoid duplication with oneLiner)
  const proposalParts = []

  // Only add premise if we have other narrative elements to show with it
  // This prevents showing the same concept twice when no narrative blocks are filled
  const hasNarrativeBlocks = arc || pivot || evidence || resolution

  if (hook && premise !== concept) {
    // If we have both hook and premise, show premise as context
    proposalParts.push(`Campaign Premise: ${premise}`)
  } else if (!hook && premise && premise !== concept && hasNarrativeBlocks) {
    // Only show premise if it's different from concept AND we have other blocks
    proposalParts.push(`Campaign Premise: ${premise}`)
  }

  if (arc) proposalParts.push(`Narrative Arc: ${arc}`)
  if (pivot) proposalParts.push(`Pivotal Moment: ${pivot}`)
  if (evidence) proposalParts.push(`Supporting Evidence: ${evidence}`)
  if (resolution) proposalParts.push(`Expected Outcome: ${resolution}`)

  const proposal = proposalParts.length > 0 ? proposalParts.join('\n\n') : ''
  return { oneLiner, bullets, proposal }
}

function explainWhy(tags: string[]) {
  const top = (tags || []).slice(0,2).join(' / ')
  return top || 'Strong creative fit'
}
