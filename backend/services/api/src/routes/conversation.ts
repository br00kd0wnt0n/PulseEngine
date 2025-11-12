import { Router } from 'express'
import { AppDataSource } from '../db/data-source.js'
import { ConversationMessage } from '../db/entities/ConversationMessage.js'
import { Project } from '../db/entities/Project.js'

const router = Router({ mergeParams: true })

router.get('/', async (req, res) => {
  const list = await AppDataSource.getRepository(ConversationMessage).find({ where: { projectId: (req.params as any).id }, order: { createdAt: 'ASC' } })
  res.json(list)
})

router.post('/', async (req, res) => {
  const projectId = (req.params as any).id
  const { role = 'user', content } = req.body || {}
  if (!content) return res.status(400).json({ error: 'content required' })
  const p = await AppDataSource.getRepository(Project).findOne({ where: { id: projectId } })
  if (!p) return res.status(404).json({ error: 'project not found' })
  const msg = AppDataSource.getRepository(ConversationMessage).create({ projectId, role, content })
  await AppDataSource.getRepository(ConversationMessage).save(msg)
  res.status(201).json(msg)
})

export default router

