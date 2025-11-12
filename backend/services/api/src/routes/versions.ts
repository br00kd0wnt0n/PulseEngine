import { Router } from 'express'
import { AppDataSource } from '../db/data-source.js'
import { ProjectVersion } from '../db/entities/ProjectVersion.js'
import { Project } from '../db/entities/Project.js'

const router = Router({ mergeParams: true })

router.get('/', async (req, res) => {
  const list = await AppDataSource.getRepository(ProjectVersion).find({ where: { projectId: req.params.id }, order: { createdAt: 'DESC' } })
  res.json(list)
})

router.post('/', async (req, res) => {
  const projectId = req.params.id
  const { summary, narrative, scores, changeSummary } = req.body || {}
  if (!summary) return res.status(400).json({ error: 'summary required' })
  // validate project exists
  const p = await AppDataSource.getRepository(Project).findOne({ where: { id: projectId } })
  if (!p) return res.status(404).json({ error: 'project not found' })
  const v = AppDataSource.getRepository(ProjectVersion).create({ projectId, summary, narrative: narrative || null, scores: scores || {}, changeSummary: changeSummary || null })
  await AppDataSource.getRepository(ProjectVersion).save(v)
  res.status(201).json(v)
})

export default router

