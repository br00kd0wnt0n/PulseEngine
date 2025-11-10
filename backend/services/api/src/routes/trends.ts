import { Router } from 'express'
import { AppDataSource } from '../db/data-source.js'
import { Trend } from '../db/entities/Trend.js'

const router = Router()

router.get('/', async (_req, res) => {
  const rows = await AppDataSource.getRepository(Trend).find({ order: { createdAt: 'DESC' } })
  res.json(rows)
})

router.post('/', async (req, res) => {
  const repo = AppDataSource.getRepository(Trend)
  const user = (req as any).user
  const t = repo.create({ label: req.body.label, signals: req.body.signals || {}, metrics: req.body.metrics || {}, ownerId: user.sub })
  await repo.save(t)
  res.status(201).json(t)
})

router.post('/score', async (req, res) => {
  const { label, signals } = req.body || {}
  // simple scoring heuristic placeholder
  const score = Math.min(100, 40 + (label?.length || 0) / 2 + Object.keys(signals || {}).length * 8)
  res.json({ narrativePotential: Math.round(score), longevity: 40 + Math.round(Math.random() * 40) })
})

export default router

