import { Router } from 'express'
import { AppDataSource } from '../db/data-source.js'
import { Creator } from '../db/entities/Creator.js'
import { JwtClaims } from '../middleware/auth.js'

const router = Router()

router.get('/', async (_req, res) => {
  const repo = AppDataSource.getRepository(Creator)
  const rows = await repo.find({ order: { createdAt: 'DESC' } })
  res.json(rows)
})

router.post('/', async (req, res) => {
  const repo = AppDataSource.getRepository(Creator)
  const user = (req as any).user as JwtClaims
  const c = repo.create({ ...req.body, ownerId: user.sub })
  await repo.save(c)
  res.status(201).json(c)
})

router.put('/:id', async (req, res) => {
  const repo = AppDataSource.getRepository(Creator)
  const { name, platform, category, metadata } = req.body
  const allowed: Record<string, any> = {}
  if (name !== undefined) allowed.name = name
  if (platform !== undefined) allowed.platform = platform
  if (category !== undefined) allowed.category = category
  if (metadata !== undefined) allowed.metadata = metadata
  await repo.update({ id: req.params.id }, allowed)
  const updated = await repo.findOneByOrFail({ id: req.params.id })
  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  const repo = AppDataSource.getRepository(Creator)
  await repo.delete({ id: req.params.id })
  res.status(204).end()
})

export default router

