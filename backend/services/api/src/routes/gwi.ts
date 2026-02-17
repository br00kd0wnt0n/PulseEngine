import { Router } from 'express'
import { fetchGWIInsights, isGWIConfigured } from '../services/external/gwi.js'

const router = Router()

/**
 * POST /gwi/query
 * Query GWI Spark API for audience insights
 */
router.post('/query', async (req, res) => {
  if (!isGWIConfigured()) {
    return res.status(503).json({ ok: false, error: 'GWI Spark API token not configured' })
  }

  const { concept, targetAudience, nodeType, nodeContext, region, persona, projectId } = req.body

  if (!concept || !nodeType) {
    return res.status(400).json({ ok: false, error: 'concept and nodeType are required' })
  }

  try {
    const result = await fetchGWIInsights({ concept, targetAudience, nodeType, nodeContext, region, persona, projectId })
    res.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('[GWI] Query failed:', e)
    res.status(500).json({ ok: false, error: e?.message || String(e) })
  }
})

/**
 * GET /gwi/status
 * Check if GWI API is configured
 */
router.get('/status', (_req, res) => {
  res.json({ configured: isGWIConfigured() })
})

export default router
