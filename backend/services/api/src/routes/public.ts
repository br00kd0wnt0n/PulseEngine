import { Router } from 'express'
import { AppDataSource } from '../db/data-source.js'
import { Trend } from '../db/entities/Trend.js'
import { Creator } from '../db/entities/Creator.js'
import { Project } from '../db/entities/Project.js'
import { User } from '../db/entities/User.js'
import { narrativeFromTrends, scoreConceptMvp } from '../services/ai.js'

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

router.post('/projects', async (req, res) => {
  try {
    const { concept, adjustments, graph, focusId } = req.body || {}
    const ds = AppDataSource
    // Use or create a public owner
    const userRepo = ds.getRepository(User)
    let owner = await userRepo.findOne({ where: { email: 'seed@pulse.local' } })
    if (!owner) {
      owner = userRepo.create({ email: 'seed@pulse.local', passwordHash: 'seed', role: 'admin' })
      await userRepo.save(owner)
    }
    await ds.query('SELECT app.set_current_user($1::uuid)', [owner.id])

    let finalConcept = concept
    if (!finalConcept && adjustments?.trendId) {
      const trend = await ds.getRepository(Trend).findOne({ where: { id: adjustments.trendId } })
      const name = trend?.label || 'Trend'
      const a = adjustments
      finalConcept = `What-if: Adjusted ${name} P/L/R ${a.potential}/${a.longevity}/${a.resonance}`
    }
    if (!finalConcept) return res.status(400).json({ error: 'concept required' })

    const narrative = await narrativeFromTrends(graph || { nodes: [], links: [] }, focusId || null)
    const score = scoreConceptMvp(finalConcept, graph || { nodes: [], links: [] })
    const proj = ds.getRepository(Project).create({ ownerId: owner.id, concept: finalConcept, persona: 'Public', platforms: [], areasOfInterest: [], narrative, scores: score })
    await ds.getRepository(Project).save(proj)
    res.status(201).json(proj)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

router.get('/projects', async (_req, res) => {
  const rows = await AppDataSource.getRepository(Project).find({ order: { createdAt: 'DESC' } })
  res.json(rows.map(p => ({ id: p.id, concept: p.concept, persona: p.persona, narrative: p.narrative, scores: p.scores, createdAt: p.createdAt })))
})

router.get('/projects/:id', async (req, res) => {
  const p = await AppDataSource.getRepository(Project).findOne({ where: { id: req.params.id } })
  if (!p) return res.status(404).json({ error: 'not found' })
  res.json({ id: p.id, concept: p.concept, persona: p.persona, narrative: p.narrative, scores: p.scores, createdAt: p.createdAt })
})
