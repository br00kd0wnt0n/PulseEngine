import { Router } from 'express'
import { narrativeFromTrends, scoreConceptMvp, generateRecommendations, generateDebrief, generateOpportunities, generateEnhancements, generateConceptProposal } from '../services/ai.js'
import { retrieveContext, formatContextForPrompt } from '../services/retrieval.js'
import { generateEmbedding } from '../services/embeddings.js'
import { searchResultCache, generateCacheKey } from '../services/cache.js'

const router = Router()

router.post('/narrative', async (req, res) => {
  const { graph, focusId } = req.body || {}

  // Handle Canvas workflow structure (with concept, debrief, opportunities)
  if (graph && typeof graph === 'object' && graph.concept && !graph.nodes) {
    const { concept, persona, region, debrief, opportunities, selectedOpportunities } = graph

    // Build context from selected opportunities
    const oppText = opportunities && opportunities.length > 0
      ? opportunities.map((o: any) => `${o.title}: ${o.why}`).join('\n')
      : 'No opportunities selected'

    const prompt = `Given this campaign concept: "${concept}"\n` +
      `Persona: ${persona || 'General audience'}\n` +
      `Region: ${region || 'Worldwide'}\n` +
      `\nDebrief: ${debrief || 'N/A'}\n` +
      `\nSelected Opportunities:\n${oppText}\n\n` +
      `Create a comprehensive end-to-end narrative structure for this campaign. Include:\n` +
      `1. Opening hook and why now\n` +
      `2. Content pillars and story arc\n` +
      `3. How each opportunity integrates\n` +
      `4. Platform strategy and timeline\n` +
      `5. Success metrics\n\n` +
      `Keep it strategic and actionable, 8-12 sentences.`

    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (apiKey) {
        const { OpenAI } = await import('openai')
        const client = new OpenAI({ apiKey })
        const resp = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 500
        })
        const text = resp.choices?.[0]?.message?.content || 'Unable to generate narrative'
        return res.json({ text })
      }
    } catch (err) {
      console.error('[AI] Failed to generate narrative:', err)
    }

    // Fallback response
    return res.json({ text: `Narrative Structure\n\nOpening Hook: ${concept}\n\nThis campaign leverages ${selectedOpportunities?.length || 0} key opportunities to create a multi-platform narrative that resonates with ${persona || 'the target audience'} in ${region || 'key markets'}. By integrating user-generated content, influencer partnerships, and platform-native formats, the campaign builds momentum across touchpoints while maintaining a cohesive story arc.\n\nSuccess will be measured through viewership growth, engagement metrics, and brand sentiment over a 6-month period.` })
  }

  // Handle traditional TrendGraph structure
  const text = await narrativeFromTrends(graph, focusId)
  res.json({ text })
})

export default router

router.post('/rewrite-narrative', async (req, res) => {
  const { concept, narrative, enhancements, persona, region, projectId } = req.body || {}
  if (!concept || !narrative) return res.status(400).json({ error: 'concept and narrative required' })
  const enh = Array.isArray(enhancements) ? enhancements.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 8) : []
  const prompt = `You are a campaign strategist.\nRewrite the narrative below for the concept "${concept}"${persona?` (persona: ${persona})`:''}${region?` (region: ${region})`:''}, integrating these selected enhancements. Keep the same structure (numbered sections) and make it crisp, specific, and actionable.\n\n# Current Narrative\n${narrative}\n\n# Selected Enhancements\n${enh.map((e: string, i: number) => `${i+1}. ${e}`).join('\\n')}\n\nReturn ONLY the rewritten narrative, preserving numbered section headings.`
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return res.json({ text: narrative })
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey })
    const resp = await client.chat.completions.create({
      model: process.env.MODEL_NAME || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an entertainment storytelling strategist. Be concise, insight-first.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 700
    })
    const text = resp.choices?.[0]?.message?.content || narrative
    res.json({ text })
  } catch (e: any) {
    console.error('[AI] rewrite-narrative failed:', e)
    res.json({ text: narrative })
  }
})

router.post('/wildcard', async (req, res) => {
  const { concept, persona, region, projectId, baseline } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })
  try {
    const userId = (req as any).user?.sub || null
    // cache key to avoid duplicate re-runs during a session
    const cacheKey = generateCacheKey('wildcard', concept, persona || '', region || '', projectId || '', baseline || '')
    const cached = searchResultCache.get(cacheKey)
    if (cached) {
      return res.json(cached)
    }

    const ctx = await retrieveContext(concept, userId, { maxResults: 20, includeCore: true, includeLive: true, projectId: projectId || null })

    // Flatten and enumerate context to force grounded citations
    type CtxItem = { id: string; text: string; source: string; bucket: 'project'|'core'|'live'|'predictive' }
    const flat: CtxItem[] = []
    const pushItems = (arr: string[], src: string[], bucket: CtxItem['bucket']) => {
      const len = Math.min(arr.length, src.length)
      for (let i = 0; i < len; i++) {
        flat.push({ id: `ctx${flat.length+1}`, text: arr[i], source: src[i], bucket })
      }
    }
    pushItems(ctx.projectContent, ctx.sources.project, 'project')
    pushItems(ctx.coreKnowledge, ctx.sources.core, 'core')
    pushItems(ctx.liveMetrics, ctx.sources.live, 'live')
    pushItems(ctx.predictiveTrends, ctx.sources.predictive, 'predictive')

    const enumerated = flat.map(it => `${it.id}: ${it.text}`).join('\n')

    const prompt = `You are a contrarian campaign strategist. Generate 1–2 WILDCARD insights that defy default assumptions AND are testable this week.
Concept: "${concept}"${persona?` (persona: ${persona})`:''}${region?` (region: ${region})`:''}

Grounding context (each item has an id). Cite ONLY using these ids:
${enumerated}

Strict rules:
- No generic advice; do not restate any existing narrative or debrief.
- Each idea must clearly challenge common platform tactics or biases and include at least one trade‑off.
- Each idea MUST include exactly 3 evidence citations using id format like "ctx3" that map to the provided context.
- Be specific, quantified where possible.

Output ONLY strict JSON with this schema and keys, no prose:
{
  "ideas": [
    {
      "title": string,                  // <= 12 words
      "contrarianWhy": string[],        // 1-2 bullets
      "evidence": string[],             // exactly 3 items, each like "ctx#"
      "upside": string,                 // quantified potential (e.g., +X%)
      "risks": string[],                // <= 3 bullets
      "testPlan": string[],             // <= 3 bullets for this week
      "firstStep": string               // 1 line, cheap + falsifiable
    }
  ]
}`

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return res.json({ ideas: [] })
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey })
    
    async function callModel(extraSystem?: string) {
      const messages = [
        { role: 'system' as const, content: 'You challenge assumptions and propose bold but testable wildcard insights. Be specific and cite only provided ids.' },
        ...(extraSystem ? [{ role: 'system' as const, content: extraSystem }] : []),
        { role: 'user' as const, content: prompt }
      ]
      const resp = await client.chat.completions.create({
        model: process.env.MODEL_NAME || 'gpt-4o-mini',
        temperature: 0.9,
        top_p: 0.9,
        presence_penalty: 0.6,
        frequency_penalty: 0.4,
        messages,
        max_tokens: 650
      })
      return resp.choices?.[0]?.message?.content || '{}'
    }

    function tryParse(jsonText: string): any | null {
      try { return JSON.parse(jsonText) } catch {}
      // Extract JSON block if model wrapped in prose
      const m = jsonText.match(/\{[\s\S]*\}/)
      if (m) { try { return JSON.parse(m[0]) } catch {} }
      return null
    }

    function validateAndMapIdeas(obj: any): { ideas: any[]; sourcesUsed: string[] } {
      const out: any[] = []
      const used = new Set<string>()
      const validIds = new Set(flat.map(f => f.id))
      if (!obj || !Array.isArray(obj.ideas)) return { ideas: [], sourcesUsed: [] }
      for (const idea of obj.ideas) {
        if (!idea || typeof idea !== 'object') continue
        const title = typeof idea.title === 'string' ? idea.title.trim() : null
        const contrarianWhy = Array.isArray(idea.contrarianWhy) ? idea.contrarianWhy.filter((s: any) => typeof s === 'string' && s.trim()).slice(0, 2) : []
        const evidence = Array.isArray(idea.evidence) ? idea.evidence.filter((s: any) => typeof s === 'string' && validIds.has(s.trim())).slice(0, 3) : []
        const upside = typeof idea.upside === 'string' ? idea.upside.trim() : null
        const risks = Array.isArray(idea.risks) ? idea.risks.filter((s: any) => typeof s === 'string' && s.trim()).slice(0, 3) : []
        const testPlan = Array.isArray(idea.testPlan) ? idea.testPlan.filter((s: any) => typeof s === 'string' && s.trim()).slice(0, 3) : []
        const firstStep = typeof idea.firstStep === 'string' ? idea.firstStep.trim() : null

        if (!title || !upside || !firstStep) continue
        if (evidence.length !== 3) continue
        // Map sources used
        evidence.forEach((eid: string) => {
          const match = flat.find(f => f.id === eid)
          if (match) used.add(match.source)
        })
        out.push({ title, contrarianWhy, evidence, upside, risks, testPlan, firstStep })
      }
      return { ideas: out.slice(0, 2), sourcesUsed: Array.from(used) }
    }

    // First roll
    let raw = await callModel()
    let parsed = tryParse(raw)
    let { ideas, sourcesUsed } = validateAndMapIdeas(parsed)

    // Optional novelty gate against baseline (debrief+narrative, if provided)
    if (baseline && ideas.length) {
      try {
        const baseEmb = await generateEmbedding(baseline)
        const ideaEmbeds = await Promise.all(ideas.map(i => generateEmbedding(
          `${i.title}. Why: ${i.contrarianWhy?.join(' ')}. ${i.upside}. ${i.testPlan?.join(' ')}`
        )))
        const sims = ideaEmbeds.map(vec => cosineSimilarity(vec, baseEmb))
        const tooSimilar = sims.map(s => (typeof s === 'number' && s >= 0.8))
        if (tooSimilar.every(Boolean)) {
          // re-roll once with explicit novelty instruction
          raw = await callModel('Avoid overlap with prior narrative/debrief; generate different ideas with new angles.')
          parsed = tryParse(raw)
          const v2 = validateAndMapIdeas(parsed)
          ideas = v2.ideas
          sourcesUsed = v2.sourcesUsed
        } else {
          // filter out similar ones
          ideas = ideas.filter((_, idx) => !tooSimilar[idx])
        }
      } catch {}
    }

    const payload = { ideas, sourcesUsed }
    searchResultCache.set(cacheKey, payload)
    return res.json(payload)
  } catch (e: any) {
    console.error('[AI] wildcard failed:', e)
    res.json({ ideas: [] })
  }
})

// local cosine similarity helper (handles nulls)
function cosineSimilarity(a: number[] | null, b: number[] | null): number | null {
  if (!a || !b || a.length !== b.length) return null
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i] }
  if (na === 0 || nb === 0) return null
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

router.post('/score', async (req, res) => {
  const { concept, graph } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })
  const g = graph ?? { nodes: [], links: [] }
  const result = scoreConceptMvp(concept, g)
  // Extend with overall + commercial + impact map
  const narrative = result.scores.narrativeStrength
  const ttpWks = result.scores.timeToPeakWeeks
  const ttp = Math.max(0, Math.min(100, 100 - (ttpWks - 1) * 12)) // sooner peak => higher score
  const cross = (result as any).ralph?.crossPlatformPotential ?? 0
  const commercial = Math.round(
    0.6 * result.scores.collaborationOpportunity + 0.4 * ((result as any).ralph?.culturalRelevance ?? 50)
  )
  const overall = Math.round((narrative + ttp + cross + commercial) / 4)
  const impactMap = {
    hookClarity: Math.min(20, (result.hits.keywordHits?.length || 0) * 2),
    loopMoment: (concept.toLowerCase().includes('loop') ? 10 : 0),
    collabPlan: Math.min(20, result.scores.collaborationOpportunity / 5),
  }
  res.json({ ...result, extended: { overall, commercialPotential: commercial, crossPlatformPotential: cross, timeToPeakScore: ttp, impactMap } })
})

router.post('/recommendations', async (req, res) => {
  const { concept, graph, persona, projectId } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })
  try {
    // Extract userId from request if authenticated (added by authMiddleware)
    const userId = (req as any).user?.sub || null
    const data = await generateRecommendations(concept, graph || { nodes: [], links: [] }, userId, persona || null, projectId || null)
    res.json(data)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

router.post('/debrief', async (req, res) => {
  const { concept, persona, projectId } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })
  try {
    const userId = (req as any).user?.sub || null
    const data = await generateDebrief(concept, userId, persona || null, projectId || null)
    res.json(data)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

router.post('/opportunities', async (req, res) => {
  const { concept, persona, projectId } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })
  try {
    const userId = (req as any).user?.sub || null
    const data = await generateOpportunities(concept, userId, persona || null, projectId || null)
    res.json(data)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

router.post('/enhancements', async (req, res) => {
  const { concept, graph, persona } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })
  try {
    const userId = (req as any).user?.sub || null
    const data = await generateEnhancements(concept, graph || { nodes: [], links: [] }, userId, persona || null)
    res.json(data)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

router.post('/concept-proposal', async (req, res) => {
  const { concept, narrativeBlocks, recommendedCreators, persona, projectId } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })
  try {
    const userId = (req as any).user?.sub || null
    const data = await generateConceptProposal(
      concept,
      narrativeBlocks || [],
      recommendedCreators || [],
      userId,
      persona || null,
      projectId || null
    )
    res.json(data)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

router.post('/concept-overview', async (req, res) => {
  const { concept, persona, region, debrief, opportunities, narrative, enhancements, projectId } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })

  try {
    const userId = (req as any).user?.sub || null

    // Build context from all inputs
    const parts: string[] = []
    parts.push(`Concept: ${concept}`)
    if (persona) parts.push(`Target Persona: ${persona}`)
    if (region) parts.push(`Region: ${region}`)
    if (debrief) parts.push(`\nStrategic Brief:\n${debrief}`)
    if (opportunities && Array.isArray(opportunities) && opportunities.length > 0) {
      parts.push(`\nSelected Opportunities:\n${opportunities.map((o: any) => `- ${o.title}: ${o.why}`).join('\n')}`)
    }
    if (narrative) parts.push(`\nNarrative Structure:\n${narrative}`)
    if (enhancements && Array.isArray(enhancements) && enhancements.length > 0) {
      parts.push(`\nApplied Enhancements:\n${enhancements.map((e: string, i: number) => `${i+1}. ${e}`).join('\n')}`)
    }

    const fullContext = parts.join('\n\n')

    const prompt = `You are a campaign strategist creating an executive summary.

Based on all the work below, create a concise Concept Overview that synthesizes the decisions made and outlines major next steps. This will be shared with the team.

${fullContext}

Structure the overview as:
1. **Campaign Essence** (1-2 sentences capturing the core idea)
2. **Strategic Approach** (2-3 key decisions/pillars)
3. **Execution Highlights** (2-3 tactical elements)
4. **Next Steps** (3-4 immediate action items)

Keep it crisp, actionable, and focused on outcomes. Total length: 6-8 sentences across all sections.`

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return res.json({ overview: fullContext })

    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey })
    const resp = await client.chat.completions.create({
      model: process.env.MODEL_NAME || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a senior campaign strategist. Be concise and insight-first.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    })

    const overview = resp.choices?.[0]?.message?.content || 'Unable to generate overview'
    res.json({ overview })
  } catch (e: any) {
    console.error('[AI] concept-overview failed:', e)
    res.status(500).json({ error: e?.message || 'failed' })
  }
})
