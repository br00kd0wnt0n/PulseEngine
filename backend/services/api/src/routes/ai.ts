import { Router } from 'express'
import { narrativeFromTrends, scoreConceptMvp, generateRecommendations, generateDebrief, generateOpportunities, generateEnhancements } from '../services/ai.js'

const router = Router()

router.post('/narrative', async (req, res) => {
  const { graph, focusId } = req.body || {}
  const text = await narrativeFromTrends(graph, focusId)
  res.json({ text })
})

export default router

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
  const { concept, graph } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })
  try {
    // Extract userId from request if authenticated (added by authMiddleware)
    const userId = (req as any).user?.sub || null
    const data = await generateRecommendations(concept, graph || { nodes: [], links: [] }, userId)
    res.json(data)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

router.post('/debrief', async (req, res) => {
  const { concept } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })
  try {
    const userId = (req as any).user?.sub || null
    const data = await generateDebrief(concept, userId)
    res.json(data)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

router.post('/opportunities', async (req, res) => {
  const { concept } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })
  try {
    const userId = (req as any).user?.sub || null
    const data = await generateOpportunities(concept, userId)
    res.json(data)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

router.post('/enhancements', async (req, res) => {
  const { concept, graph } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })
  try {
    const userId = (req as any).user?.sub || null
    const data = await generateEnhancements(concept, graph || { nodes: [], links: [] }, userId)
    res.json(data)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})
