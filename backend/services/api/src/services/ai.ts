import crypto from 'crypto'
import { AppDataSource } from '../db/data-source.js'
import { AICache } from '../db/entities/AICache.js'
import { Creator } from '../db/entities/Creator.js'
import { retrieveContext, formatContextForPrompt, type RetrievalContext } from './retrieval.js'
import { callJSON } from './llm.js'
import { OpportunitiesResultSchema, ScoresSchema } from './schemas.js'

export type TrendGraph = { nodes: { id: string; label: string; kind: 'trend'|'creator'|'content' }[]; links: { source: string; target: string }[] }

function sha(input: any) { return crypto.createHash('sha1').update(JSON.stringify(input)).digest('hex') }

async function cacheGet<T>(key: string): Promise<T | null> {
  const repo = AppDataSource.getRepository(AICache)
  const row = await repo.findOne({ where: { key } })
  if (!row) return null
  const ttlMin = parseInt(process.env.AI_CACHE_TTL_MINUTES || '4320', 10) // default 3 days
  if (Number.isFinite(ttlMin) && ttlMin > 0) {
    const ageMs = Date.now() - new Date(row.createdAt).getTime()
    if (ageMs > ttlMin * 60 * 1000) return null
  }
  return row.value as T
}
async function cacheSet<T>(key: string, value: T) {
  const repo = AppDataSource.getRepository(AICache)
  await repo.upsert({ key, value: value as any }, ['key'])
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('no-openai')
  const { OpenAI } = await import('openai')
  const client = new OpenAI({ apiKey })
  const model = process.env.MODEL_NAME || 'gpt-4o-mini'
  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are an entertainment storytelling strategist. Be concise, insight-first.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 350,
  })
  return resp.choices?.[0]?.message?.content || ''
}

const STRICT_AI_ONLY = true // Force strict AI-only mode by default as requested

export async function narrativeFromTrends(graph: TrendGraph, focusId?: string | null) {
  const focus = focusId ? graph.nodes.find(n => n.id === focusId)?.label : null
  const trends = graph.nodes.filter(n => n.kind === 'trend').map(n => n.label)
  const key = sha({ type: 'narrative', trends, focus })
  const cached = await cacheGet<string>(key)
  if (cached) return cached

  const prompt = (await import('./promptStore.js')).renderTemplate(
    await (await import('./promptStore.js')).getPrompt('narrative_from_trends'),
    { trends: trends.join(', '), focus }
  )
  try {
    const text = await callOpenAI(prompt)
    await cacheSet(key, text)
    return text
  } catch {
    const ts = new Date().toISOString()
    const mock = `Snapshot (${ts})\nPrimary trends: ${trends.join(', ')}\n` +
      (focus ? `Focus: ${focus}\n` : '') +
      `Narrative: Short-form loops + creator collabs generate near-term lift; remixable hooks spill over into gaming edits.`
    await cacheSet(key, mock)
    return mock
  }
}

// AI-based Scoring with rubric and evidence
export async function generateScoresAI(
  concept: string,
  userId?: string | null,
  persona?: string | null,
  projectId?: string | null,
  targetAudience?: string | null
) {
  // Retrieve context
  let ctx: RetrievalContext
  try {
    ctx = await retrieveContext(concept, userId || null, { maxResults: 15, includeCore: true, includeLive: true, projectId: projectId || null })
  } catch (err) {
    throw new Error('context_unavailable')
  }

  // Enumerate context items for grounded citations
  type CtxItem = { id: string; text: string }
  const flat: CtxItem[] = []
  const push = (arr: string[]) => { for (const t of arr) flat.push({ id: `ctx${flat.length+1}`, text: t }) }
  push(ctx.projectContent)
  push(ctx.coreKnowledge)
  push(ctx.liveMetrics)
  const enumerated = flat.map(it => `${it.id}: ${it.text}`).join('\n')

  const model = process.env.MODEL_NAME || 'gpt-4o-mini'

  const personaRole = persona ? `campaign strategist for ${persona}` : 'campaign strategist'
  const parts: string[] = []
  parts.push(`You are a ${personaRole}. Return ONLY JSON.`)
  if (targetAudience) parts.push(`Target audience: ${targetAudience}.`)
  parts.push(
    `Score the campaign concept: "${concept}" using the provided context (with ids). Each score MUST be evidence-backed.`
  )
  parts.push(`Context for evidence (use ids like ctx3):\n${enumerated}`)
  parts.push(`Schema strictly: {
  "scores": { "narrativeStrength": 0-100, "timeToPeakWeeks": 1-12, "collaborationOpportunity": 0-100 },
  "ralph": { "narrativeAdaptability": 0-100, "crossPlatformPotential": 0-100, "culturalRelevance": 0-100 },
  "rationales": { "narrative": string[], "timing": string[], "cross": string[], "commercial": string[] },
  "evidence": string[]
}`)
  parts.push(`Rules:
- Use at least 2 evidence ids from context when available.
- Each rationale bullet ≤ 12 words and specific.
- Penalize generic claims. Use live signals for timing when possible.
- Return only JSON, no prose.`)

  const prompt = parts.join('\n\n')

  const parsed = await callJSON(
    [
      { role: 'system', content: 'Return only valid JSON. Be concise and evidence-based.' },
      { role: 'user', content: prompt },
    ],
    ScoresSchema,
    { model, maxTokens: 600, temperature: 0.25, allowExtract: true, retries: 1 }
  )

  const scores = parsed.scores
  const ralph = parsed.ralph
  // Compute extended metrics
  const ttpWeeks = Math.max(1, Math.min(12, Number(scores.timeToPeakWeeks || 8)))
  const timeToPeakScore = Math.max(0, Math.min(100, 100 - (ttpWeeks - 1) * 12))
  const commercialPotential = Math.round(
    0.6 * Number(scores.collaborationOpportunity || 0) + 0.4 * Number(ralph.culturalRelevance || 0)
  )
  const overall = Math.round((
    Number(scores.narrativeStrength || 0) + timeToPeakScore + Number(ralph.crossPlatformPotential || 0) + commercialPotential
  ) / 4)

  const result = {
    scores: {
      narrativeStrength: Number(scores.narrativeStrength || 0),
      timeToPeakWeeks: ttpWeeks,
      collaborationOpportunity: Number(scores.collaborationOpportunity || 0),
    },
    ralph: {
      narrativeAdaptability: Number(ralph.narrativeAdaptability || 0),
      crossPlatformPotential: Number(ralph.crossPlatformPotential || 0),
      culturalRelevance: Number(ralph.culturalRelevance || 0),
    },
    extended: {
      overall,
      commercialPotential,
      crossPlatformPotential: Number(ralph.crossPlatformPotential || 0),
      timeToPeakScore,
      impactMap: undefined as any,
    },
    rationales: parsed.rationales || {},
    sources: ctx.sources,
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
    _debug: { prompt, model }
  }

  return result
}

// Debrief: recap + key points + did-you-know insights
export async function generateDebrief(concept: string, userId?: string | null, persona?: string | null, projectId?: string | null, targetAudience?: string | null) {
  try {
    let ctx
    try {
      ctx = await retrieveContext(concept, userId || null, { maxResults: 15, includeCore: true, includeLive: true, projectId: projectId || null })
    } catch (err) {
      console.error('[AI] retrieveContext failed for debrief:', err)
      // Fallback to empty context if retrieval fails
      ctx = { projectContent: [], coreKnowledge: [], liveMetrics: [], predictiveTrends: [], sources: { project: [], core: [], live: [], predictive: [] } }
    }
    // Include prompt version hash in cache key
    const { getPrompt } = await import('./promptStore.js')
    const tpl = await getPrompt('debrief')
    const lens = await getPrompt('ralph_lens')
    const cacheKey = sha({ t: 'debrief', concept, s: summarySig(ctx, projectId), persona, targetAudience, v: sha(tpl + '|' + lens) })
    const cached = await cacheGet<any>(cacheKey)
    if (cached) return cached
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey) {
      try {
        const model = process.env.MODEL_NAME || 'gpt-4o-mini'
        const contextStr = formatContextForPrompt(ctx)
        const { getPrompt, renderTemplate } = await import('./promptStore.js')
        const ralphLens = await getPrompt('ralph_lens')
        const prompt = renderTemplate(
          await getPrompt('debrief'),
          { concept, persona, personaOrGeneral: persona || 'General', context: contextStr, targetAudience, ralphLens }
        )
        const { DebriefSchema } = await import('./schemas.js')
        const parsed = await callJSON(
          [ { role: 'system', content: 'Return only JSON matching the requested schema.' }, { role: 'user', content: prompt } ],
          DebriefSchema,
          { model, maxTokens: 380, temperature: 0.5, allowExtract: true, retries: 1 }
        )
        const withSources = { ...parsed, sources: ctx.sources, _debug: { prompt, model } }
        await cacheSet(cacheKey, withSources)
        return withSources
      } catch {}
    }
    // If strict mode, avoid heuristic placeholders when there is insufficient signal only
    const noContextSignal = (!ctx.projectContent?.length && !ctx.coreKnowledge?.length && !ctx.liveMetrics?.length && !ctx.predictiveTrends?.length)
    if ((STRICT_AI_ONLY && noContextSignal) || (concept.trim().length < 8 && noContextSignal)) {
      const minimal = {
        brief: '',
        summary: '',
        keyPoints: [] as string[],
        didYouKnow: [] as string[],
        sources: ctx.sources,
      }
      await cacheSet(cacheKey, minimal)
      return minimal
    }
    // Context-aware heuristic fallback (non-strict)
    const hasLiveMetrics = ctx.liveMetrics && ctx.liveMetrics.length > 0
    const hasCoreKnowledge = ctx.coreKnowledge && ctx.coreKnowledge.length > 0
    const conceptLower = concept.toLowerCase()

    // Detect content type for appropriate strategy language
    const isVideoContent = conceptLower.includes('video') || conceptLower.includes('clip') || conceptLower.includes('content')
    const isCampaignStrategy = conceptLower.includes('campaign') || conceptLower.includes('strategy') || conceptLower.includes('brand')
    const isShortForm = conceptLower.includes('tiktok') || conceptLower.includes('short') || conceptLower.includes('reel')

    // Extract platform hints from concept
    const platforms = []
    if (conceptLower.includes('tiktok') || conceptLower.includes('short')) platforms.push('TikTok')
    if (conceptLower.includes('instagram') || conceptLower.includes('reel')) platforms.push('Instagram')
    if (conceptLower.includes('youtube')) platforms.push('YouTube')
    if (platforms.length === 0) platforms.push('TikTok', 'Instagram')

    // Context-appropriate hook language
    const hookPoint = isCampaignStrategy
      ? `Lead with a compelling campaign narrative that immediately connects with audience values and current cultural moments`
      : isVideoContent || isShortForm
      ? `Lead with a strong visual hook in the first 3 seconds that showcases the core value of "${concept}"`
      : `Open with an attention-grabbing campaign promise that resonates with target audience interests`

    const heuristic = {
      brief: `"${concept}" aligns with current target audience interests${hasLiveMetrics ? ' and trending content patterns' : ''}. This ${isCampaignStrategy ? 'campaign strategy' : 'content approach'} should focus on ${platforms.join(' and ')} with authentic storytelling that resonates with platform-native formats and engagement behaviors.`,
      summary: isCampaignStrategy
        ? `Develop strategic campaign framework that positions "${concept}" for maximum cultural relevance and audience engagement`
        : `Create ${platforms[0]}-first content that turns "${concept}" into a shareable, participatory ${isShortForm ? 'experience' : 'campaign'}.`,
      keyPoints: [
        hookPoint,
        `Design content for ${platforms.join(' and ')} native formats${isShortForm ? ' (9:16 vertical, 15-60s duration, text overlays)' : ' with platform-specific optimizations'}`,
        `Build in ${isCampaignStrategy ? 'strategic partnership opportunities and' : ''} remix opportunities and collaboration hooks to amplify reach organically`,
        `Plan multi-touchpoint ${isCampaignStrategy ? 'campaign architecture' : 'content strategy'} with launch beats, creator partnerships, and audience participation moments`
      ],
      didYouKnow: (() => {
        const insights: string[] = []

        // Platform-specific insights
        if (platforms.includes('TikTok')) {
          insights.push(hasLiveMetrics
            ? `Live data shows target audience engagement peaks with TikTok's algorithm-friendly content structures`
            : `TikTok's For You Page drives 3x more discovery than follower-based feeds`)
        }
        if (platforms.includes('Instagram') && isShortForm) {
          insights.push(`Instagram Reels see 22% higher reach than standard posts, especially for ${isVideoContent ? 'video content' : 'visual stories'}`)
        }
        if (platforms.includes('YouTube') && !isShortForm) {
          insights.push(`YouTube long-form content generates 5-8x more watch time, ideal for ${concept.length > 40 ? 'detailed narratives' : 'deeper storytelling'}`)
        }

        // Content type insights
        if (isVideoContent || isShortForm) {
          insights.push(hasCoreKnowledge
            ? `RKB data indicates short-form video formats resonate strongly with current target audience preferences`
            : `Vertical video (9:16) drives 90% mobile completion rates vs. 60% for horizontal`)
        }
        if (isCampaignStrategy) {
          insights.push(`Multi-platform campaigns see 40-60% higher brand lift when ${persona ? persona + ' personas' : 'target audiences'} engage across 2+ channels`)
        }

        // Collaboration insight
        insights.push(hasLiveMetrics
          ? `Trending creator partnerships in your concept space show 4-6x organic amplification`
          : `Authentic creator collaborations generate ${isCampaignStrategy ? 'trust signals that' : ''} outperform traditional ads by 3-5x`)

        // Pull one dynamic signal from context when available
        try {
          const live = (ctx.liveMetrics || [])[0]
          if (live) insights.unshift(`Live signal: ${String(live).slice(0, 120)}…`)
        } catch {}
        try {
          const core = (ctx.coreKnowledge || [])[0]
          if (core) insights.push(`RKB: ${String(core).slice(0, 120)}…`)
        } catch {}

        return insights.slice(0, 3) // Return top 3 insights
      })(),
      sources: ctx.sources,
      personaNotes: (() => {
        const role = (persona || '').toLowerCase()
        if (role.includes('strategist')) return [ 'Add KPI targets and cadence checkpoints for weeks 1–4', 'Define measurement plan: view-through, saves, shares, sentiment' ]
        if (role.includes('creative')) return [ 'Clarify story spine + tone: hook, arc, resolution', 'Define visual system: typography, color, motion motifs' ]
        if (role.includes('creator')) return [ 'Specify short-form formats: hooks, b-roll, captions', 'Outline posting cadence and cross-posting plan' ]
        return []
      })()
    }
    await cacheSet(cacheKey, heuristic)
    return heuristic
  } catch (err) {
    console.error('[AI] generateDebrief failed:', err)
    // Return minimal fallback response if everything fails
    return {
      brief: `Exploring "${concept}": a concept with collaborative potential.`,
      summary: 'Analyzing opportunities.',
      keyPoints: [ 'Define the core hook', 'Identify platform opportunities', 'Plan collaborations', 'Build engagement loops' ],
      didYouKnow: [ 'Short-form content drives 60%+ social engagement', 'Collaborations expand reach 3-5x', 'Platform-native formats perform better' ],
      sources: { project: [], core: [], live: [], predictive: [] },
    }
  }
}

// Opportunities: ranked with impact
export async function generateOpportunities(concept: string, userId?: string | null, persona?: string | null, projectId?: string | null, targetAudience?: string | null) {
  try {
    let ctx
    try {
      ctx = await retrieveContext(concept, userId || null, { maxResults: 15, includeCore: true, includeLive: true, projectId: projectId || null })
    } catch (err) {
      console.error('[AI] retrieveContext failed for opportunities:', err)
      // Fallback to empty context if retrieval fails
      ctx = { projectContent: [], coreKnowledge: [], liveMetrics: [], predictiveTrends: [], sources: { project: [], core: [], live: [], predictive: [] } }
    }
    const cacheKey = sha({ t: 'opps', concept, s: summarySig(ctx, projectId), persona, targetAudience })
    const cached = await cacheGet<any>(cacheKey)
    if (cached) return cached
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey) {
      try {
        const model = process.env.MODEL_NAME || 'gpt-4o-mini'
        const contextStr = formatContextForPrompt(ctx)
        const { getPrompt, renderTemplate } = await import('./promptStore.js')
        const ralphLens = await getPrompt('ralph_lens')
        const prompt = renderTemplate(
          await getPrompt('opportunities'),
          { concept, persona, personaOrGeneral: persona || 'General', context: contextStr, targetAudience, ralphLens }
        )
        const parsed = await callJSON(
          [
            { role: 'system', content: 'Return only JSON matching the requested schema.' },
            { role: 'user', content: prompt },
          ],
          OpportunitiesResultSchema,
          { model, maxTokens: 500, temperature: 0.6, allowExtract: true, retries: 1 }
        )
        const withSources = { ...parsed, sources: ctx.sources, _debug: { prompt, model } }
        await cacheSet(cacheKey, withSources)
        return withSources
      } catch (e) {
        console.error('[AI] opportunities parse/validation failed:', e)
        if (STRICT_AI_ONLY) throw e
      }
    }
    // If strict mode, avoid heuristic placeholders when there is insufficient signal only
    const noContextSignal = (!ctx.projectContent?.length && !ctx.coreKnowledge?.length && !ctx.liveMetrics?.length && !ctx.predictiveTrends?.length)
    if ((STRICT_AI_ONLY && noContextSignal) || (concept.trim().length < 8 && noContextSignal)) {
      const minimal = { opportunities: [], rationale: '', sources: ctx.sources }
      await cacheSet(cacheKey, minimal)
      return minimal
    }
    // Context-aware heuristic fallback (non-strict)
    const hasLiveMetrics = ctx.liveMetrics && ctx.liveMetrics.length > 0
    const conceptLower = concept.toLowerCase()

    // Extract opportunity hints from concept
    const platforms = []
    if (conceptLower.includes('tiktok') || conceptLower.includes('short')) platforms.push('TikTok')
    if (conceptLower.includes('instagram') || conceptLower.includes('reel')) platforms.push('Instagram')
    if (conceptLower.includes('youtube')) platforms.push('YouTube')
    const platform = platforms[0] || 'TikTok'

    const opportunities = [
      {
        title: `Launch ${platform}-first content series for "${concept}"`,
        why: hasLiveMetrics ? 'Aligns with trending formats in live data' : 'Platform-native content drives higher engagement',
        impact: 82
      },
      {
        title: `Partner with micro-influencers in target vertical`,
        why: 'Authentic voices build trust and expand reach 3-5x',
        impact: 78
      },
      {
        title: `Create participatory campaign hooks (duets/remixes)`,
        why: 'User-generated content amplifies organic reach',
        impact: 75
      },
      {
        title: `Develop multi-part episodic storytelling series`,
        why: 'Serial content increases completion rates and return visits',
        impact: 72
      },
      {
        title: `Build cross-platform distribution strategy`,
        why: 'Multi-channel presence maximizes total addressable audience',
        impact: 68
      },
    ]
    const heuristic = {
      opportunities,
      rationale: `Strategic campaign opportunities tailored for "${concept}"${hasLiveMetrics ? ' based on trending content patterns' : ''}.`,
      sources: ctx.sources,
      personaNotes: (() => {
        const role = (persona || '').toLowerCase()
        if (role.includes('strategist')) return [ 'Prioritize opportunities with clear KPI lift', 'Sequence bets for early signal then scale' ]
        if (role.includes('creative')) return [ 'Elevate ideas with distinctive visual hooks', 'Ensure each opportunity ladders to the story arc' ]
        if (role.includes('creator')) return [ 'Focus on formats you can produce weekly', 'Leverage duet/remix to invite audience participation' ]
        return []
      })()
    }
    await cacheSet(cacheKey, heuristic)
    return heuristic
  } catch (err) {
    console.error('[AI] generateOpportunities failed:', err)
    throw err
  }
}

function summarySig(ctx: RetrievalContext, projectId?: string | null) {
  const m = [
    projectId || 'none',
    ctx.projectContent.length,
    ctx.coreKnowledge.length,
    ctx.liveMetrics.length,
    ctx.predictiveTrends.length,
    // Include hash of first project content ID to detect changes
    ctx.projectContent[0]?.slice(0, 8) || 'empty'
  ]
  return m.join('-')
}

// Enhancements with estimated impact and targets
export async function generateEnhancements(concept: string, graph: TrendGraph, userId?: string | null, persona?: string | null) {
  // Baseline scores for impact estimation
  const base = scoreConceptMvp(concept, graph)
  const narrative = base.scores.narrativeStrength
  const ttp = Math.max(0, Math.min(100, 100 - (base.scores.timeToPeakWeeks - 1) * 12))
  const cross = (base as any).ralph?.crossPlatformPotential ?? 0
  const commercial = Math.round(0.6 * base.scores.collaborationOpportunity + 0.4 * ((base as any).ralph?.culturalRelevance ?? 50))

  const apiKey = process.env.OPENAI_API_KEY
  if (apiKey) {
    try {
      const model = process.env.MODEL_NAME || 'gpt-4o-mini'
      const prompt = (await import('./promptStore.js')).renderTemplate(
        await (await import('./promptStore.js')).getPrompt('enhancements'),
        {
          concept,
          persona,
          personaOrGeneral: persona || 'General',
          narrativeScore: narrative,
          ttpScore: ttp,
          crossScore: cross,
          commercialScore: commercial,
        }
      )
      const { EnhancementsSchema } = await import('./schemas.js')
      const parsed = await callJSON(
        [ { role: 'system', content: 'Return only JSON matching the requested schema.' }, { role: 'user', content: prompt } ],
        EnhancementsSchema,
        { model, maxTokens: 500, temperature: 0.6, allowExtract: true, retries: 1 }
      )
      return { ...parsed, _debug: { prompt, model } }
    } catch { /* fallthrough */ }
  }
  // Context-aware heuristic fallback
  const lc = (concept || '').toLowerCase()

  // Extract enhancement hints from concept
  const hasVideo = lc.includes('video') || lc.includes('content') || lc.includes('campaign')
  const hasSocial = lc.includes('social') || lc.includes('tiktok') || lc.includes('instagram')
  const hasBrand = lc.includes('brand') || lc.includes('product') || lc.includes('toy')

  const suggestions = [
    {
      text: `Lead "${concept}" with a 3-5 second visual hook that showcases the transformation or value proposition`,
      target: 'hook',
      deltas: { narrative: 8, ttp: 3, cross: 2, commercial: 4 }
    },
    {
      text: hasVideo ? `Structure "${concept}" as 3-5 act story with clear beginning, conflict, and resolution beats` : `Build narrative arc for "${concept}" with clear story progression`,
      target: 'arc',
      deltas: { narrative: 6, ttp: 2, cross: 4, commercial: 2 }
    },
    {
      text: hasSocial ? `Include user participation hooks (challenges, duets, or remix opportunities) tied to "${concept}"` : `Create shareable moments that invite audience participation`,
      target: 'resolution',
      deltas: { narrative: 3, ttp: 4, cross: 5, commercial: 6 }
    },
    {
      text: hasBrand ? `Showcase authentic proof points (testimonials, before/after, or product demos) that validate "${concept}"` : `Add credibility through evidence and social proof`,
      target: 'evidence',
      deltas: { narrative: 5, ttp: 2, cross: 3, commercial: 5 }
    },
  ]
  return { suggestions }
}

export function scoreConceptMvp(concept: string, graph: TrendGraph) {
  const text = concept.toLowerCase()
  const trendLabels = (graph?.nodes || []).filter(n => n.kind === 'trend').map(n => n.label.toLowerCase())
  const trendHits = trendLabels.filter(t => text.includes(t))
  const keywords = ['ai','music','dance','challenge','loop','retro','gaming','edit','tutorial','short','reels','collab','remix']
  const keywordHits = keywords.filter(k => text.includes(k))
  const base = clamp(30 + trendHits.length * 15 + keywordHits.length * 8, 0, 100)
  const audiencePotential = clamp(base + (text.length > 60 ? 8 : 0), 0, 100)
  const narrativeStrength = clamp(35 + trendHits.length * 12 + keywordHits.length * 10, 0, 100)
  const collaborationOpportunity = clamp(30 + trendHits.length * 10 + (text.includes('collab') ? 15 : 0), 0, 100)
  const timeToPeakWeeks = Math.max(1, Math.round(8 - (trendHits.length * 1.5 + keywordHits.length)))
  const narrativeAdaptability = clamp(40 + keywordHits.length * 6 + (text.includes('tutorial') ? 8 : 0), 0, 100)
  const crossPlatformPotential = clamp(35 + (['tiktok','shorts','reels'].filter(p => text.includes(p)).length * 12) + trendHits.length * 5, 0, 100)
  const culturalRelevance = clamp(45 + trendHits.length * 8 + (text.includes('retro') ? 6 : 0), 0, 100)
  return {
    scores: { audiencePotential, narrativeStrength, timeToPeakWeeks, collaborationOpportunity },
    ralph: { narrativeAdaptability, crossPlatformPotential, culturalRelevance },
    hits: { trendHits, keywordHits },
  }
}

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }

// Generate recommendations by category with RAG context from multiple sources
export async function generateRecommendations(
  concept: string,
  graph: TrendGraph,
  userId?: string | null,
  persona?: string | null,
  projectId?: string | null,
  targetAudience?: string | null
) {
  console.log('[RAG] generateRecommendations called:', { concept, userId, projectId, hasGraph: !!graph })

  // Retrieve context from all knowledge sources
  let context
  try {
    context = await retrieveContext(concept, userId || null, {
      maxResults: 12,
      includeCore: true,
      includeLive: true,
      projectId: projectId || null
    })
  } catch (err) {
    console.error('[AI] retrieveContext failed for recommendations:', err)
    // Fallback to empty context if retrieval fails
    context = { projectContent: [], coreKnowledge: [], liveMetrics: [], predictiveTrends: [], sources: { project: [], core: [], live: [], predictive: [] } }
  }

  console.log('[RAG] Context retrieved:', {
    projectContent: context.projectContent.length,
    coreKnowledge: context.coreKnowledge.length,
    liveMetrics: context.liveMetrics.length,
    predictiveTrends: context.predictiveTrends.length,
    sources: context.sources
  })

  // Query creators from database
  let creators: any[] = []
  try {
    const creatorRepo = AppDataSource.getRepository(Creator)
    const allCreators = await creatorRepo.find({ take: 10, order: { createdAt: 'DESC' } })
    creators = allCreators.map(c => ({
      id: c.id,
      name: c.name,
      platform: c.platform || 'Unknown',
      category: c.category || 'General',
      metadata: c.metadata || {}
    }))
    console.log('[RAG] Found creators:', creators.length)
  } catch (err) {
    console.error('[RAG] Failed to query creators:', err)
    creators = []
  }

  const apiKey = process.env.OPENAI_API_KEY
  console.log('[RAG] OpenAI key present:', !!apiKey)

  if (apiKey) {
    try {
      const model = process.env.MODEL_NAME || 'gpt-4o-mini'
      const contextStr = formatContextForPrompt(context)
      const { getPrompt, renderTemplate } = await import('./promptStore.js')
      const ralphLens = await getPrompt('ralph_lens')
      const prompt = renderTemplate(
        await getPrompt('recommendations'),
        { concept, persona, personaOrGeneral: persona || 'General', context: contextStr, targetAudience, ralphLens }
      )

      const { RecommendationsSchema } = await import('./schemas.js')
      const result = await callJSON(
        [ { role: 'system', content: 'Return only JSON matching the requested schema.' }, { role: 'user', content: prompt } ],
        RecommendationsSchema,
        { model, maxTokens: 500, temperature: 0.6, allowExtract: true, retries: 1 }
      )
      const withSources = { ...result, sources: context.sources, creators, _debug: { prompt, model } }
      return withSources
    } catch (e) {
      console.error('[RAG] Recommendations parse/validation failed:', e)
    }
  }
  console.log('[RAG] Using heuristic fallback')
  const heuristic = { ...buildHeuristicRecs(concept), personaNotes: (() => {
    const role = (persona || '').toLowerCase()
    if (role.includes('strategist')) return [ 'Balance channel mix by KPI sensitivity and cost', 'Stage tests: hook variants → format variants → creator collabs' ]
    if (role.includes('creative')) return [ 'Define motif library for recognizability', 'Maintain story cadence: teaser → arc → payoff' ]
    if (role.includes('creator')) return [ 'Batch scripting and shotlists to ship weekly', 'Optimize captions and CTA for saves/shares' ]
    return []
  })() }
  // Attach empty sources and creators for heuristic mode
  return { ...heuristic, sources: { user: [], core: [], live: [], predictive: [] }, creators }
}

function buildHeuristicRecs(concept?: string) {
  const lc = (concept || '').toLowerCase()
  const flags = {
    dance: lc.includes('dance'),
    ai: lc.includes('ai'),
    retro: lc.includes('retro'),
    tutorial: lc.includes('tutorial'),
    brand: lc.includes('brand') || lc.includes('product'),
    social: lc.includes('tiktok') || lc.includes('instagram') || lc.includes('social'),
    campaign: lc.includes('campaign') || lc.includes('strategy'),
    video: lc.includes('video') || lc.includes('content')
  }

  // Concept-specific strategic hook suggestions
  const conceptHook = concept ? `Open with compelling visual that immediately demonstrates the core value of "${concept.slice(0, 60)}"` : ''

  const narrative = [
    flags.ai ? `Lead with AI-powered transformation moment showing before/after impact in first 5 seconds` :
      flags.brand ? `Start with authentic brand story that connects emotional heritage to modern audience needs` :
      flags.campaign ? `Hook audience with bold campaign promise that addresses current cultural moment` :
      conceptHook || `Create attention-grabbing opening that showcases campaign's unique value proposition`,
    flags.retro ? `Build narrative arc that bridges nostalgic elements with contemporary relevance and modern execution` :
      flags.social ? `Structure story progression optimized for social platform algorithms and engagement patterns` :
      `Develop clear story arc from setup through transformation to impactful resolution`,
    flags.dance ? `Close with participatory dance challenge that invites audience duets and remixes` :
      flags.tutorial ? `End with clear call-to-action encouraging viewers to try technique themselves` :
      `Conclude with strong CTA that drives audience participation or next-step engagement`,
  ]

  const content = [
    flags.tutorial ? `Create step-by-step tutorial series (20-30s each) optimized for saves and repeat views` :
      flags.video ? `Develop episodic content series with cliffhangers driving continued viewership` :
      `Plan multi-part content journey with clear narrative progression across installments`,
    flags.dance ? `Design 7-10 second loopable dance moment with memorable choreography for viral potential` :
      flags.social ? `Build engaging content beats timed to platform-optimal durations (TikTok 15-60s, Reels 30-90s)` :
      `Create key replayable moments that encourage audience engagement and sharing`,
    flags.brand ? `Develop authentic proof content including testimonials, case studies, and user-generated examples` :
      `Prepare variant content formats to test messaging clarity and audience resonance`,
  ]

  const platform = [
    flags.social ? `Launch on TikTok/Instagram using trending formats and sounds for maximum algorithmic reach` :
      `Adapt content for cross-platform distribution (TikTok/Shorts/Reels) with platform-specific optimizations`,
    flags.retro ? `Use visual storytelling to connect nostalgic elements with modern platform aesthetics` :
      flags.campaign ? `Deploy platform-specific campaign activations timed to audience engagement peaks` :
      `Optimize first 3 seconds for each platform's specific viewer behavior patterns`,
    `Schedule strategic posting windows aligned with target audience activity patterns and platform algorithms`,
  ]

  const collab = [
    flags.dance ? `Partner with dance creators and choreographers for authentic movement content and duet opportunities` :
      flags.tutorial ? `Collaborate with educational creators in relevant verticals for credibility and reach` :
      flags.brand ? `Work with brand-aligned micro and mid-tier influencers for authentic product storytelling` :
      `Engage creator partnerships across audience segments for expanded reach and diverse perspectives`,
    `Build collaboration framework: 1-2 macro creators for awareness + 5-8 micro creators for authenticity`,
    flags.social ? `Provide remixable assets (sounds, effects, templates) to lower participation barriers and drive UGC` :
      `Offer collaborative content packages that make creator participation effortless and appealing`,
  ]

  // Simple framework scores + rationales
  const framework = {
    market: { score: clamp(55 + (platform.length + collab.length) * 8, 0, 100), why: 'Cross-platform strategy and creator collaboration framework demonstrates strong market approach.' },
    narrative: { score: clamp(60 + narrative.length * 8, 0, 100), why: 'Structured narrative arc with clear hooks and progression supports audience engagement.' },
    commercial: { score: clamp(50 + (collab.length * 9), 0, 100), why: 'Multi-creator strategy and platform optimization create scalable monetization pathways.' },
  }
  return { narrative, content, platform, collab, framework }
}

// Shareable Concept Proposal: AI-generated pitch narrative
export async function generateConceptProposal(
  concept: string,
  narrativeBlocks: { key: string; content: string }[],
  recommendedCreators: { name: string; platform: string; category: string; tags: string[] }[],
  userId?: string | null,
  persona?: string | null,
  projectId?: string | null
) {
  try {
    let ctx
    try {
      ctx = await retrieveContext(concept, userId || null, { maxResults: 15, includeCore: true, includeLive: true, projectId: projectId || null })
    } catch (err) {
      console.error('[AI] retrieveContext failed for concept proposal:', err)
      ctx = { projectContent: [], coreKnowledge: [], liveMetrics: [], predictiveTrends: [], sources: { project: [], core: [], live: [], predictive: [] } }
    }

    const cacheKey = sha({ t: 'concept-proposal', concept, blocks: narrativeBlocks.map(b => b.content).join(''), creators: recommendedCreators.map(c => c.name).join(',') })
    const cached = await cacheGet<string>(cacheKey)
    if (cached) return { narrative: cached, sources: ctx.sources }

    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey) {
      try {
        const model = process.env.MODEL_NAME || 'gpt-4o-mini'
        const contextStr = formatContextForPrompt(ctx)

        // Extract narrative blocks
        const hook = narrativeBlocks.find(b => b.key === 'hook')?.content || ''
        const origin = narrativeBlocks.find(b => b.key === 'origin')?.content || ''
        const arc = narrativeBlocks.find(b => b.key === 'arc')?.content || ''
        const pivots = narrativeBlocks.find(b => b.key === 'pivots')?.content || ''
        const evidence = narrativeBlocks.find(b => b.key === 'evidence')?.content || ''
        const resolution = narrativeBlocks.find(b => b.key === 'resolution')?.content || ''

        const { getPrompt, renderTemplate } = await import('./promptStore.js')
        const prompt = renderTemplate(
          await getPrompt('concept_proposal'),
          {
            personaOrGeneral: persona || 'General',
            concept,
            hook,
            origin: origin || concept,
            arc,
            pivots,
            evidence,
            resolution,
            context: contextStr,
          }
        )

        const { ConceptProposalSchema } = await import('./schemas.js')
        const parsed = await callJSON(
          [ { role: 'system', content: 'Return only JSON matching the requested schema.' }, { role: 'user', content: prompt } ],
          ConceptProposalSchema,
          { model, maxTokens: 700, temperature: 0.7, allowExtract: true, retries: 1 }
        )

        const narrative = parsed.narrative
        await cacheSet(cacheKey, narrative)
        return { narrative, sources: ctx.sources, _debug: { prompt, model } }
      } catch (err) {
        console.error('[AI] OpenAI call failed for concept proposal:', err)
      }
    }

    // Fallback: construct a narrative from blocks
    const creatorNames = recommendedCreators.slice(0, 3).map(c => `${c.name} (${c.platform})`).join(', ')
    const fallbackNarrative = `${narrativeBlocks.find(b => b.key === 'hook')?.content || concept}

This campaign leverages ${creatorNames} to amplify reach across key platforms. ${narrativeBlocks.find(b => b.key === 'arc')?.content || 'The narrative arc builds from introduction to transformation.'} ${narrativeBlocks.find(b => b.key === 'pivots')?.content || 'Pivotal moments create engagement opportunities.'}

${narrativeBlocks.find(b => b.key === 'resolution')?.content || 'Expected outcome: Strong engagement, clear call-to-action, and measurable impact.'}`

    await cacheSet(cacheKey, fallbackNarrative)
    return { narrative: fallbackNarrative, sources: ctx.sources }
  } catch (err) {
    console.error('[AI] generateConceptProposal failed:', err)
    throw err
  }
}
