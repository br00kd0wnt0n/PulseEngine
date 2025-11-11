import { Router } from 'express'
import { narrativeFromTrends, scoreConceptMvp } from '../services/ai.js'

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
  res.json(result)
})
