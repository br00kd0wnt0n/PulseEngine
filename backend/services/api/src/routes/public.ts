import { Router } from 'express'
import { AppDataSource } from '../db/data-source.js'
import { Trend } from '../db/entities/Trend.js'
import { Creator } from '../db/entities/Creator.js'
import { Project } from '../db/entities/Project.js'
import { narrativeFromTrends, scoreConceptMvp, TrendGraph } from '../services/ai.js'

const router = Router()

// GET /public/trends — read-only trend list
router.get('/trends', async (_req, res) => {
  try {
    const rows = await AppDataSource.getRepository(Trend).find({ order: { createdAt: 'DESC' } })
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) })
  }
})

// GET /public/creators — read-only creator list
router.get('/creators', async (_req, res) => {
  try {
    const rows = await AppDataSource.getRepository(Creator).find({ order: { createdAt: 'DESC' } })
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) })
  }
})

// POST /public/projects — create project without auth
router.post('/projects', async (req, res) => {
  const { concept, persona = 'Social Strategist', platforms = [], areasOfInterest = [], graph, focusId } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })
  try {
    const repo = AppDataSource.getRepository(Project)
    const g: TrendGraph = graph ?? { nodes: [], links: [] }
    const [narrative, score] = await Promise.all([
      narrativeFromTrends(g, focusId || null),
      Promise.resolve(scoreConceptMvp(concept, g)),
    ])
    const p = repo.create({ ownerId: 'public', concept, persona, platforms, areasOfInterest, narrative, scores: score })
    await repo.save(p)
    res.status(201).json(p)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) })
  }
})

// GET /public/projects — list projects
router.get('/projects', async (_req, res) => {
  try {
    const rows = await AppDataSource.getRepository(Project).find({ order: { createdAt: 'DESC' } })
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) })
  }
})

// GET /public/projects/:id — single project
router.get('/projects/:id', async (req, res) => {
  try {
    const p = await AppDataSource.getRepository(Project).findOne({ where: { id: req.params.id } })
    if (!p) return res.status(404).json({ error: 'not found' })
    res.json(p)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) })
  }
})

export default router
