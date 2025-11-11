import { Router } from 'express'
import { AppDataSource } from '../db/data-source.js'
import { Trend } from '../db/entities/Trend.js'
import { Creator } from '../db/entities/Creator.js'

const router = Router()

router.get('/trends', async (_req, res) => {
  const rows = await AppDataSource.getRepository(Trend).find({ order: { createdAt: 'DESC' } })
  // Return minimal public fields
  res.json(rows.map(t => ({ id: t.id, label: t.label, metrics: (t as any).metrics || {}, signals: (t as any).signals || {} })))
})

router.get('/creators', async (_req, res) => {
  const rows = await AppDataSource.getRepository(Creator).find({ order: { createdAt: 'DESC' } })
  res.json(rows.map(c => ({ id: c.id, name: c.name, platform: c.platform, category: c.category, metadata: (c as any).metadata || {} })))
})

export default router

