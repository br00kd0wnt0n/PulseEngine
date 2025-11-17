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
export async function generateDebrief(concept: string, userId?: string | null, persona?: string | null) {
  try {
    let ctx
    try {
      ctx = await retrieveContext(concept, userId || null, { maxResults: 6, includeCore: true, includeLive: true })
    } catch (err) {
      console.error('[AI] retrieveContext failed for debrief:', err)
      // Fallback to empty context if retrieval fails
      ctx = { projectContent: [], coreKnowledge: [], liveMetrics: [], predictiveTrends: [], sources: { project: [], core: [], live: [], predictive: [] } }
    }
    const cacheKey = sha({ t: 'debrief', concept, s: summarySig(ctx) })
    const cached = await cacheGet<any>(cacheKey)
    if (cached) return cached
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey) {
      try {
        const { OpenAI } = await import('openai')
        const client = new OpenAI({ apiKey })
        const model = process.env.MODEL_NAME || 'gpt-4o-mini'
        const contextStr = formatContextForPrompt(ctx)
        const prompt = `Persona: ${persona || 'General'}\nConcept: "${concept}"\n\n`+
          (contextStr?`Context (concise):\n${contextStr}\n\n`:'')+
          `Return JSON with brief (2–3 sentences), summary (1 sentence), keyPoints (4 bullets), didYouKnow (3 items).`
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
    const heuristic = {
      brief: `Recap for "${concept}": short‑form concept with collaborative hooks and platform‑native framing.`,
      summary: 'Opportunity in native hooks + remixable beats.',
      keyPoints: [ 'Clarify the promise in line one', 'Define a loopable moment', 'Map platform trims', 'Plan 1 macro + 3 micro collabs' ],
      didYouKnow: [ 'Loops increase completion by 18–35%', 'Remix prompts lift creator adoption', 'Native captions boost recall' ],
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
export async function generateOpportunities(concept: string, userId?: string | null, persona?: string | null) {
  try {
    let ctx
    try {
      ctx = await retrieveContext(concept, userId || null, { maxResults: 6, includeCore: true, includeLive: true })
    } catch (err) {
      console.error('[AI] retrieveContext failed for opportunities:', err)
      // Fallback to empty context if retrieval fails
      ctx = { projectContent: [], coreKnowledge: [], liveMetrics: [], predictiveTrends: [], sources: { project: [], core: [], live: [], predictive: [] } }
    }
    const cacheKey = sha({ t: 'opps', concept, s: summarySig(ctx) })
    const cached = await cacheGet<any>(cacheKey)
    if (cached) return cached
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey) {
      try {
        const { OpenAI } = await import('openai')
        const client = new OpenAI({ apiKey })
        const model = process.env.MODEL_NAME || 'gpt-4o-mini'
        const contextStr = formatContextForPrompt(ctx)
        const prompt = `Persona: ${persona || 'General'}\nConcept: "${concept}"\n\n`+
          (contextStr?`Context (concise):\n${contextStr}\n\n`:'')+
          `Identify 5 opportunities with title, why, and impact (0-100). Return JSON { opportunities: [{ title, why, impact }], rationale }.`
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
    const opportunities = [
      { title: 'Sharpen the opening hook', why: 'Improves comprehension and retention', impact: 78 },
      { title: 'Add duet/stitch prompt', why: 'Boosts creator participation', impact: 72 },
      { title: 'Platform-native captions', why: 'Increases message recall', impact: 64 },
      { title: 'Remixable beat (7–10s)', why: 'Encourages replays and loops', impact: 70 },
      { title: 'Macro + micro collab mix', why: 'Combines reach with authenticity', impact: 68 },
    ]
    const heuristic = { opportunities, rationale: 'Based on common uplift levers across short‑form and collab patterns.', sources: ctx.sources }
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

function summarySig(ctx: RetrievalContext) {
  const m = [ctx.projectContent.length, ctx.coreKnowledge.length, ctx.liveMetrics.length, ctx.predictiveTrends.length]
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
      const prompt = `You are improving a short concept for persona ${persona || 'General'}: "${concept}".\n`+
        `Current scores (0-100): narrative=${narrative}, ttp=${ttp}, cross=${cross}, commercial=${commercial}.\n`+
        `Propose 4 targeted enhancements. For each, return: text, target (one of origin|hook|arc|pivots|evidence|resolution), and deltas { narrative, ttp, cross, commercial } indicating expected score changes (integers, +/-).\n`+
        `Return JSON: { suggestions: [{ text, target, deltas: { narrative, ttp, cross, commercial } }] }`
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
  // Heuristic fallback with simple deltas
  const lc = (concept || '').toLowerCase()
  const hasLoop = lc.includes('loop')
  const hasCollab = lc.includes('collab') || lc.includes('duet') || lc.includes('stitch')
  const suggestions = [
    { text: 'Condense the opening hook to 7–10 words', target: 'hook', deltas: { narrative: 6, ttp: 2, cross: 0, commercial: 1 } },
    { text: 'Define a loopable 7–10s beat with a visible cue', target: 'arc', deltas: { narrative: hasLoop ? 2 : 6, ttp: 4, cross: 3, commercial: 2 } },
    { text: 'Add a duet/stitch prompt to invite creator responses', target: 'resolution', deltas: { narrative: 2, ttp: 1, cross: 2, commercial: hasCollab ? 2 : 6 } },
    { text: 'Add platform‑native captions stating the promise in frame 1', target: 'evidence', deltas: { narrative: 4, ttp: 2, cross: 3, commercial: 1 } },
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

      const prompt = `You are a storytelling strategist for persona: ${persona || 'General'}. Given this story concept: "${concept}"\n\n` +
        (contextStr ? `# RELEVANT CONTEXT:\n${contextStr}\n\n` : '') +
        `# TASK:\n` +
        `Provide 4 categories of recommendations with 3 concise, practical bullets each:\n` +
        `- Narrative Development\n- Content Strategy\n- Platform Coverage\n- Collaboration\n` +
        `Base your recommendations on the context provided above, especially user-uploaded knowledge and live trends.\n` +
        `Also include a framework object with 3 dimensions (market, narrative, commercial), each with a numeric score (0-100) and a one-sentence why.\n` +
        `Return strictly as JSON with keys narrative, content, platform, collab (arrays of strings), and framework { market: { score, why }, narrative: { score, why }, commercial: { score, why } }.`

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
    dance: lc.includes('dance'), ai: lc.includes('ai'), retro: lc.includes('retro'), tutorial: lc.includes('tutorial')
  }
  const narrative = [
    flags.ai ? 'Lean into AI hook; make the benefit explicit in sentence one.' : 'Clarify the core hook in sentence one.',
    flags.retro ? 'Tie nostalgia to a modern pattern with a named device.' : 'Add a cultural beat that resonates with target audience.',
    'Close with a prompt that invites creator response (duet/stitch).',
  ]
  const content = [
    flags.tutorial ? 'Produce a 20–30s how‑to variant to boost saves.' : 'Plan a tutorial cut to improve saves and replays.',
    flags.dance ? 'Design a loop‑friendly beat for the dance moment (7–10s).' : 'Identify a loopable moment to support replays.',
    'Prepare 3–5 caption variants to test hook clarity.',
  ]
  const platform = [
    'Ship trims for TikTok/Shorts/Reels; tailor the first 2s to each.',
    flags.retro ? 'Use overlays to connect nostalgia with present relevance.' : 'Use overlays to state the promise in frame 1.',
    'Schedule posts to match your audience’s peak windows.',
  ]
  const collab = [
    flags.dance ? 'Target dance creators with a duet prompt and a clear beat.' : 'Invite creator remixes with a simple prompt and stitch cue.',
    'Line up 1 macro + 3 micro collaborators for coverage.',
    'Offer a shared asset (beat/overlay) to ease adoption.',
  ]
  // Simple framework scores + rationales
  const framework = {
    market: { score: clamp(50 + (platform.length + collab.length) * 8, 0, 100), why: 'Solid cross‑platform plan and collaboration hooks signal healthy market fit.' },
    narrative: { score: clamp(50 + narrative.length * 10, 0, 100), why: 'Clear hook and cultural angle strengthen narrative potential.' },
    commercial: { score: clamp(45 + (collab.length * 10), 0, 100), why: 'Collaboration and format planning open monetization and scalability pathways.' },
  }
  return { narrative, content, platform, collab, framework }
}
