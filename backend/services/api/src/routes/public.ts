import { Router } from 'express'
import { AppDataSource } from '../db/data-source.js'
import { Trend } from '../db/entities/Trend.js'
import { Creator } from '../db/entities/Creator.js'
import { Project } from '../db/entities/Project.js'

const router = Router()

// GET /public/trends — read-only trend list
router.get('/trends', async (_req, res) => {
  try {
    const rows = await AppDataSource.getRepository(Trend).find({
      order: { createdAt: 'DESC' },
      take: 200,
    })
    res.json(rows)
  } catch (e: any) {
    console.error('[public/trends] Error:', e?.message)
    res.status(500).json({ error: e?.message || String(e) })
  }
})

// GET /public/creators — read-only creator list
router.get('/creators', async (_req, res) => {
  try {
    const rows = await AppDataSource.getRepository(Creator).find({
      order: { createdAt: 'DESC' },
      take: 200,
    })
    res.json(rows)
  } catch (e: any) {
    console.error('[public/creators] Error:', e?.message)
    res.status(500).json({ error: e?.message || String(e) })
  }
})

// Deterministic "public" user UUID (sha-1 of "public" truncated to UUID format)
const PUBLIC_OWNER_ID = '00000000-0000-4000-a000-000000000000'

// POST /public/projects — create project without auth (lightweight, no AI calls)
router.post('/projects', async (req, res) => {
  const { concept, persona = 'Social Strategist', platforms = [], areasOfInterest = [] } = req.body || {}
  if (!concept) return res.status(400).json({ error: 'concept required' })
  try {
    // Ensure a public user row exists for the FK constraint
    const userRepo = AppDataSource.getRepository('User')
    const exists = await userRepo.findOne({ where: { id: PUBLIC_OWNER_ID } }).catch(() => null)
    if (!exists) {
      await userRepo.save(userRepo.create({ id: PUBLIC_OWNER_ID, email: 'public@pulse.local', passwordHash: '-' })).catch(() => {})
    }

    const repo = AppDataSource.getRepository(Project)
    const p = repo.create({
      ownerId: PUBLIC_OWNER_ID,
      concept,
      persona,
      platforms,
      areasOfInterest,
      narrative: '',
      scores: {},
    })
    await repo.save(p)
    res.status(201).json(p)
  } catch (e: any) {
    console.error('[public/projects] POST Error:', e?.message)
    res.status(500).json({ error: e?.message || String(e) })
  }
})

// GET /public/projects — list projects
router.get('/projects', async (_req, res) => {
  try {
    const rows = await AppDataSource.getRepository(Project).find({
      order: { createdAt: 'DESC' },
      take: 50,
    })
    res.json(rows)
  } catch (e: any) {
    console.error('[public/projects] GET Error:', e?.message)
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
    console.error('[public/projects] GET/:id Error:', e?.message)
    res.status(500).json({ error: e?.message || String(e) })
  }
})

export default router
