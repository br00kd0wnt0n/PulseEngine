import { Router } from 'express'
import { getTrendSummary } from '../services/trendSummary.js'

const router = Router()

router.get('/', async (req, res) => {
  const period = (req.query.period as string) || 'week'
  const platform = (req.query.platform as string) || 'all'
  try {
    const data = await getTrendSummary(period as any, platform)
    res.json({ period, platform, ...data })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

export default router

