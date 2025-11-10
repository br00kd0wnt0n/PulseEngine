import { Router } from 'express'
import { narrativeFromTrends } from '../services/ai.js'

const router = Router()

router.post('/narrative', async (req, res) => {
  const { graph, focusId } = req.body || {}
  const text = await narrativeFromTrends(graph, focusId)
  res.json({ text })
})

export default router

