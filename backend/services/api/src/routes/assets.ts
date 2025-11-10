import { Router } from 'express'
import { AppDataSource } from '../db/data-source'
import { ContentAsset } from '../db/entities/ContentAsset'

const router = Router()

router.get('/', async (_req, res) => {
  const rows = await AppDataSource.getRepository(ContentAsset).find({ order: { createdAt: 'DESC' } })
  res.json(rows)
})

router.post('/', async (req, res) => {
  const repo = AppDataSource.getRepository(ContentAsset)
  const user = (req as any).user
  const a = repo.create({ name: req.body.name, url: req.body.url, tags: req.body.tags || {}, metadata: req.body.metadata || {}, ownerId: user.sub })
  await repo.save(a)
  res.status(201).json(a)
})

export default router

