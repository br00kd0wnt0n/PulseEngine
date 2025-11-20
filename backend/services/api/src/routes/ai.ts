import { Router } from 'express'
import { narrativeFromTrends, scoreConceptMvp, generateRecommendations, generateDebrief, generateOpportunities, generateEnhancements, generateConceptProposal } from '../services/ai.js'

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
