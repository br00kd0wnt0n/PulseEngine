import { Router } from 'express'
import { AppDataSource } from '../db/data-source.js'
import { Project } from '../db/entities/Project.js'
import { narrativeFromTrends, scoreConceptMvp, TrendGraph } from '../services/ai.js'

const router = Router()

router.post('/', async (req, res) => {
  const { concept, persona = 'Social Strategist', platforms = [], areasOfInterest = [], graph, focusId } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })
  const user = (req as any).user
  const repo = AppDataSource.getRepository(Project)

  // Build graph from payload or minimal defaults
  const g: TrendGraph = graph ?? { nodes: [], links: [] }
  const [narrative, score] = await Promise.all([
    narrativeFromTrends(g, focusId || null),
    Promise.resolve(scoreConceptMvp(concept, g)),
  ])

  const p = repo.create({ ownerId: user.sub, concept, persona, platforms, areasOfInterest, narrative, scores: score })
  await repo.save(p)
  res.status(201).json(p)
})

router.get('/', async (_req, res) => {
  const repo = AppDataSource.getRepository(Project)
  const rows = await repo.find({ order: { createdAt: 'DESC' } })
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const repo = AppDataSource.getRepository(Project)
  const p = await repo.findOne({ where: { id: req.params.id } })
  if (!p) return res.status(404).json({ error: 'not found' })
  res.json(p)
})

export default router
