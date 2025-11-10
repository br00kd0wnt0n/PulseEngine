import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AppDataSource } from '../db/data-source'
import { User } from '../db/entities/User'

const router = Router()

router.post('/register', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })
  const repo = AppDataSource.getRepository(User)
  const exists = await repo.findOne({ where: { email } })
  if (exists) return res.status(409).json({ error: 'email exists' })
  const u = repo.create({ email, passwordHash: await bcrypt.hash(password, 10), role: 'user' })
  await repo.save(u)
  return res.json({ ok: true })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {}
  const repo = AppDataSource.getRepository(User)
  const u = await repo.findOne({ where: { email } })
  if (!u || !(await bcrypt.compare(password || '', u.passwordHash))) return res.status(401).json({ error: 'invalid credentials' })
  const token = jwt.sign({ sub: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET || 'dev', { expiresIn: '7d' })
  res.json({ token })
})

// OAuth placeholders
router.get('/oauth/:provider/start', (_req, res) => res.status(501).json({ error: 'Not implemented' }))
router.get('/oauth/:provider/callback', (_req, res) => res.status(501).json({ error: 'Not implemented' }))

export default router

