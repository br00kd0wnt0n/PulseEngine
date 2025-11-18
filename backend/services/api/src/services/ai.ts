import crypto from 'crypto'
import { AppDataSource } from '../db/data-source.js'
import { AICache } from '../db/entities/AICache.js'
import { retrieveContext, formatContextForPrompt, type RetrievalContext } from './retrieval.js'

export type TrendGraph = { nodes: { id: string; label: string; kind: 'trend'|'creator'|'content' }[]; links: { source: string; target: string }[] }

function sha(input: any) { return crypto.createHash('sha1').update(JSON.stringify(input)).digest('hex') }

async function cacheGet<T>(key: string): Promise<T | null> {
  const repo = AppDataSource.getRepository(AICache)
  const row = await repo.findOne({ where: { key } })
  return row ? (row.value as T) : null
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

export async function narrativeFromTrends(graph: TrendGraph, focusId?: string | null) {
  const focus = focusId ? graph.nodes.find(n => n.id === focusId)?.label : null
  const trends = graph.nodes.filter(n => n.kind === 'trend').map(n => n.label)
  const key = sha({ type: 'narrative', trends, focus })
  const cached = await cacheGet<string>(key)
  if (cached) return cached

  const prompt = `Given these active trends: ${trends.join(', ')}${focus ? `\nFocus on: ${focus}` : ''}.\n` +
    `Explain the narrative opportunity in 4-6 sentences: why now, which hooks, and predicted time-to-peak. Keep it direct.`
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

// Debrief: recap + key points + did-you-know insights
export async function generateDebrief(concept: string, userId?: string | null, persona?: string | null, projectId?: string | null) {
  try {
    let ctx
    try {
      ctx = await retrieveContext(concept, userId || null, { maxResults: 6, includeCore: true, includeLive: true, projectId: projectId || null })
    } catch (err) {
      console.error('[AI] retrieveContext failed for debrief:', err)
      // Fallback to empty context if retrieval fails
      ctx = { projectContent: [], coreKnowledge: [], liveMetrics: [], predictiveTrends: [], sources: { project: [], core: [], live: [], predictive: [] } }
    }
    const cacheKey = sha({ t: 'debrief', concept, s: summarySig(ctx, projectId) })
    const cached = await cacheGet<any>(cacheKey)
    if (cached) return cached
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey) {
      try {
        const { OpenAI } = await import('openai')
        const client = new OpenAI({ apiKey })
        const model = process.env.MODEL_NAME || 'gpt-4o-mini'
        const contextStr = formatContextForPrompt(ctx)
        const prompt = `You are a campaign strategist creating a strategic brief for persona: ${persona || 'General'}.

CAMPAIGN CONCEPT: "${concept}"

${contextStr ? `# RELEVANT CONTEXT (cite these specific trends and insights):
${contextStr}

` : ''}# YOUR TASK:
Create a strategic campaign brief as JSON with these fields:

1. "brief" (2-3 sentences): Explain WHY this concept is strategically valuable right now. Reference specific trending content, platforms, or cultural moments from the context above. Be concrete and actionable.

2. "summary" (1 sentence): The core campaign insight or hook that makes this timely and engaging.

3. "keyPoints" (4 strategic bullets): Actionable campaign strategy points. Each should:
   - Be specific to THIS concept (not generic advice)
   - Reference trends or insights from the context when possible
   - Focus on execution strategy (platforms, formats, collaborations, content beats)
   - Example: "Leverage TikTok's #fyp algorithm by creating 15s hooks that mirror trending dance formats"

4. "didYouKnow" (3 contextual insights): Surprising facts or trend insights from the context that support this campaign. Cite specific platform data, trending topics, or cultural insights.

Return ONLY valid JSON. Make every field specific to "${concept}" and grounded in the provided context.`
        const resp = await client.chat.completions.create({
          model,
          messages: [ { role: 'system', content: 'Return only JSON.' }, { role: 'user', content: prompt } ],
          temperature: 0.5,
          max_tokens: 350,
        })
        const raw = resp.choices?.[0]?.message?.content || '{}'
        try {
          const parsed = JSON.parse(raw)
          const withSources = { ...parsed, sources: ctx.sources }
          await cacheSet(cacheKey, withSources)
          return withSources
        } catch {}
      } catch {}
    }
    // Context-aware heuristic fallback
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
      brief: `"${concept}" aligns with current ${persona ? persona + ' ' : ''}audience interests${hasLiveMetrics ? ' and trending content patterns' : ''}. This ${isCampaignStrategy ? 'campaign strategy' : 'content approach'} should focus on ${platforms.join(' and ')} with authentic storytelling that resonates with platform-native formats and engagement behaviors.`,
      summary: isCampaignStrategy
        ? `Develop strategic campaign framework that positions "${concept}" for maximum cultural relevance and audience engagement`
        : `Create ${platforms[0]}-first content that turns "${concept}" into a shareable, participatory ${isShortForm ? 'experience' : 'campaign'}.`,
      keyPoints: [
        hookPoint,
        `Design content for ${platforms.join(' and ')} native formats${isShortForm ? ' (9:16 vertical, 15-60s duration, text overlays)' : ' with platform-specific optimizations'}`,
        `Build in ${isCampaignStrategy ? 'strategic partnership opportunities and' : ''} remix opportunities and collaboration hooks to amplify reach organically`,
        `Plan multi-touchpoint ${isCampaignStrategy ? 'campaign architecture' : 'content strategy'} with launch beats, creator partnerships, and audience participation moments`
      ],
      didYouKnow: hasLiveMetrics
        ? [ `Live trend data shows high engagement in ${platforms[0]} content`, 'Short-form video drives 2.5x more shares than static posts', 'Authentic creator partnerships outperform paid ads by 3-5x' ]
        : [ 'Short-form video drives 60%+ of social engagement', 'Platform-native formats see 40% higher completion rates', 'Creator collaborations expand reach by 3-5x on average' ],
      sources: ctx.sources,
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
export async function generateOpportunities(concept: string, userId?: string | null, persona?: string | null, projectId?: string | null) {
  try {
    let ctx
    try {
      ctx = await retrieveContext(concept, userId || null, { maxResults: 6, includeCore: true, includeLive: true, projectId: projectId || null })
    } catch (err) {
      console.error('[AI] retrieveContext failed for opportunities:', err)
      // Fallback to empty context if retrieval fails
      ctx = { projectContent: [], coreKnowledge: [], liveMetrics: [], predictiveTrends: [], sources: { project: [], core: [], live: [], predictive: [] } }
    }
    const cacheKey = sha({ t: 'opps', concept, s: summarySig(ctx, projectId) })
    const cached = await cacheGet<any>(cacheKey)
    if (cached) return cached
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey) {
      try {
        const { OpenAI } = await import('openai')
        const client = new OpenAI({ apiKey })
        const model = process.env.MODEL_NAME || 'gpt-4o-mini'
        const contextStr = formatContextForPrompt(ctx)
        const prompt = `You are a campaign strategist for persona: ${persona || 'General'}. Analyze this campaign concept: "${concept}"

${contextStr ? `# RELEVANT CONTEXT (reference specific trends and data):
${contextStr}

` : ''}# YOUR TASK:
Identify 5 HIGH-IMPACT campaign opportunities that are:
- Specific to THIS concept (not generic tactics)
- Grounded in the trending data and insights from context above
- Actionable execution opportunities (not vague advice)
- Campaign-focused (story beats, content formats, creator partnerships, platform plays)

For each opportunity provide:
- **title**: Clear, specific opportunity (e.g., "Launch with micro-influencer unboxing series on TikTok")
- **why**: Business/strategic rationale tied to the concept and trends (50-80 chars)
- **impact**: Estimated impact score 0-100 based on trend alignment and execution potential

Also provide a brief **rationale** explaining how these opportunities work together as a campaign strategy.

Return ONLY valid JSON: { opportunities: [{ title, why, impact }], rationale }`
        const resp = await client.chat.completions.create({
          model,
          messages: [ { role: 'system', content: 'Return only JSON.' }, { role: 'user', content: prompt } ],
          temperature: 0.6,
          max_tokens: 380,
        })
        const raw = resp.choices?.[0]?.message?.content || '{}'
        try {
          const parsed = JSON.parse(raw)
          const withSources = { ...parsed, sources: ctx.sources }
          await cacheSet(cacheKey, withSources)
          return withSources
        } catch {}
      } catch {}
    }
    // Context-aware heuristic fallback
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
      sources: ctx.sources
    }
    await cacheSet(cacheKey, heuristic)
    return heuristic
  } catch (err) {
    console.error('[AI] generateOpportunities failed:', err)
    // Return minimal fallback response if everything fails
    return {
      opportunities: [
        { title: 'Define the core hook', why: 'Clear messaging drives engagement', impact: 75 },
        { title: 'Platform-specific format', why: 'Native content performs better', impact: 70 },
        { title: 'Collaboration strategy', why: 'Expands reach and authenticity', impact: 72 },
        { title: 'Engagement loops', why: 'Increases completion and sharing', impact: 68 },
        { title: 'Multi-platform distribution', why: 'Maximizes audience reach', impact: 65 },
      ],
      rationale: 'Core opportunities for content optimization.',
      sources: { project: [], core: [], live: [], predictive: [] },
    }
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
      const { OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey })
      const model = process.env.MODEL_NAME || 'gpt-4o-mini'
      const prompt = `You are a campaign strategist optimizing this concept for persona ${persona || 'General'}: "${concept}"

Current campaign scores (0-100):
- Narrative Strength: ${narrative}
- Time to Peak: ${ttp}
- Cross-Platform Potential: ${cross}
- Commercial Viability: ${commercial}

# YOUR TASK:
Propose 4 SPECIFIC, ACTIONABLE enhancements to strengthen this campaign. Each enhancement should:
- Be campaign-specific (not generic advice like "improve hook")
- Target a specific narrative element: origin|hook|arc|pivots|evidence|resolution
- Provide concrete execution guidance (e.g., "Open with 3-second product transformation visual before narration")

For each enhancement provide:
- **text**: Specific, actionable enhancement tied to "${concept}" (not generic)
- **target**: Which narrative block it enhances (origin|hook|arc|pivots|evidence|resolution)
- **deltas**: Expected score improvements { narrative, ttp, cross, commercial } (integers, can be 0 if no impact)

Return ONLY valid JSON: { suggestions: [{ text, target, deltas: { narrative, ttp, cross, commercial } }] }`
      const resp = await client.chat.completions.create({
        model,
        messages: [ { role: 'system', content: 'Return only JSON.' }, { role: 'user', content: prompt } ],
        temperature: 0.6,
        max_tokens: 420,
      })
      const raw = resp.choices?.[0]?.message?.content || '{}'
      try { const parsed = JSON.parse(raw); return parsed } catch {}
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
  const trendLabels = graph.nodes.filter(n => n.kind === 'trend').map(n => n.label.toLowerCase())
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
  projectId?: string | null
) {
  console.log('[RAG] generateRecommendations called:', { concept, userId, projectId, hasGraph: !!graph })

  // Retrieve context from all knowledge sources
  let context
  try {
    context = await retrieveContext(concept, userId || null, {
      maxResults: 5,
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

  const apiKey = process.env.OPENAI_API_KEY
  console.log('[RAG] OpenAI key present:', !!apiKey)

  if (apiKey) {
    try {
      const { OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey })
      const model = process.env.MODEL_NAME || 'gpt-4o-mini'

      // Format context for prompt
      const contextStr = formatContextForPrompt(context)

      const prompt = `You are a campaign strategist for persona: ${persona || 'General'}. You're creating an execution plan for this campaign concept: "${concept}"

${contextStr ? `# RELEVANT CONTEXT (reference specific trends and insights):
${contextStr}

` : ''}# YOUR TASK:
Create a tactical campaign execution plan with 4 categories of recommendations. Each recommendation should be:
- Specific to THIS campaign concept (not generic advice)
- Grounded in the context above (cite trending formats, platforms, or cultural moments when relevant)
- Actionable and execution-ready

**1. Narrative Development** (3 bullets):
   - Story beats, hooks, arc progression, emotional journey
   - Example: "Open with 3-second shock moment showcasing transformation, then reveal journey"

**2. Content Strategy** (3 bullets):
   - Content formats, posting cadence, content pillars, engagement loops
   - Example: "Create 5-part episodic series with cliffhangers driving viewers to next installment"

**3. Platform Coverage** (3 bullets):
   - Platform-specific tactics, format adaptations, algorithmic optimization
   - Reference trending formats from context (TikTok sounds, Instagram features, etc.)
   - Example: "Launch on TikTok using trending #fyp dance format, then adapt for Instagram Reels with extended behind-the-scenes"

**4. Collaboration** (3 bullets):
   - Creator partnerships, audience participation, remix/duet opportunities
   - Example: "Partner with 3 micro-influencers in gaming vertical for authentic reaction videos"

**5. Framework Scoring**:
   Include a framework object with 3 dimensions:
   - market: { score: 0-100, why: "one-sentence explanation of market opportunity" }
   - narrative: { score: 0-100, why: "one-sentence explanation of story strength" }
   - commercial: { score: 0-100, why: "one-sentence explanation of monetization potential" }

Return ONLY valid JSON with keys: narrative, content, platform, collab (arrays of strings), and framework object.`

      console.log('[RAG] Calling OpenAI with model:', model)
      console.log('[RAG] Prompt length:', prompt.length, 'characters')

      const resp = await client.chat.completions.create({
        model,
        messages: [ { role: 'system', content: 'Return only JSON.' }, { role: 'user', content: prompt } ],
        temperature: 0.7,
        max_tokens: 500, // Increased for richer context
      })
      const raw = resp.choices?.[0]?.message?.content || '{}'
      console.log('[RAG] OpenAI response length:', raw.length, 'characters')

      try {
        const result = JSON.parse(raw)
        // Attach sources for attribution
        result.sources = context.sources
        console.log('[RAG] Successfully parsed OpenAI response, returning with sources')
        return result
      } catch (parseErr) {
        console.error('[RAG] Failed to parse OpenAI JSON response:', parseErr)
        /* fallthrough */
      }
    } catch (e) {
      console.error('[RAG] OpenAI call failed:', e)
      /* fallthrough */
    }
  }
  console.log('[RAG] Using heuristic fallback')
  const heuristic = buildHeuristicRecs(concept)
  // Attach empty sources for heuristic mode
  return { ...heuristic, sources: { user: [], core: [], live: [], predictive: [] } }
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
      ctx = await retrieveContext(concept, userId || null, { maxResults: 6, includeCore: true, includeLive: true, projectId: projectId || null })
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
        const { OpenAI } = await import('openai')
        const client = new OpenAI({ apiKey })
        const model = process.env.MODEL_NAME || 'gpt-4o-mini'
        const contextStr = formatContextForPrompt(ctx)

        // Extract narrative blocks
        const hook = narrativeBlocks.find(b => b.key === 'hook')?.content || ''
        const origin = narrativeBlocks.find(b => b.key === 'origin')?.content || ''
        const arc = narrativeBlocks.find(b => b.key === 'arc')?.content || ''
        const pivots = narrativeBlocks.find(b => b.key === 'pivots')?.content || ''
        const evidence = narrativeBlocks.find(b => b.key === 'evidence')?.content || ''
        const resolution = narrativeBlocks.find(b => b.key === 'resolution')?.content || ''

        const prompt = `You are a creative strategist crafting a shareable campaign proposal for persona: ${persona || 'General'}.

CAMPAIGN CONCEPT: "${concept}"

NARRATIVE FRAMEWORK:
- Origin: ${origin || concept}
- Hook: ${hook}
- Narrative Arc: ${arc}
- Pivotal Moments: ${pivots}
- Supporting Evidence: ${evidence}
- Resolution/Outcome: ${resolution}

RECOMMENDED CREATIVE PARTNERS:
${recommendedCreators.map(c => `- ${c.name} (${c.platform} • ${c.category}): ${c.tags.slice(0, 2).join(', ')}`).join('\n')}

${contextStr ? `# RELEVANT CONTEXT (reference these insights):
${contextStr}

` : ''}# YOUR TASK:
Create a compelling shareable pitch narrative (5-7 sentences) that:

1. Opens with the campaign hook and core concept
2. Explains WHY this concept is strategically valuable right now (reference context/trends if available)
3. Highlights the PIVOTAL MOMENTS or key story beats that make this campaign engaging
4. Explains WHY these specific creators are perfect matches:
   - Connect each creator to specific aspects of the campaign (e.g., "${recommendedCreators[0]?.name}'s ${recommendedCreators[0]?.tags[0]} expertise aligns with...")
   - Show how their platforms/audiences amplify the campaign
5. End with the expected OUTCOME/IMPACT and call-to-action

Write as a cohesive pitch narrative, NOT a bulleted list. Make it compelling and specific to THIS concept and THESE creators.`

        const resp = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You are a creative campaign strategist. Write compelling, specific, narrative-driven pitch decks.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 400,
        })

        const narrative = resp.choices?.[0]?.message?.content || ''
        await cacheSet(cacheKey, narrative)
        return { narrative, sources: ctx.sources }
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
