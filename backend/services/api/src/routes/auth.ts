import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { AppDataSource } from '../db/data-source.js'
import { User } from '../db/entities/User.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

function issueToken(u: User) {
  return jwt.sign({ sub: u.id, role: u.role, email: u.email }, JWT_SECRET, { expiresIn: '7d' })
}

function userPayload(u: User) {
  return { id: u.id, email: u.email, displayName: u.displayName, avatarUrl: u.avatarUrl, role: u.role }
}

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
  if (!u || !u.passwordHash || !(await bcrypt.compare(password || '', u.passwordHash)))
    return res.status(401).json({ error: 'invalid credentials' })
  const token = issueToken(u)
  res.json({ token, user: userPayload(u) })
})

router.post('/google', async (req, res) => {
  const { credential } = req.body || {}
  if (!credential) return res.status(400).json({ error: 'credential required' })

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    if (!payload || !payload.email) return res.status(400).json({ error: 'invalid token payload' })

    const { sub: googleId, email, name, picture } = payload
    const repo = AppDataSource.getRepository(User)

    // Find by googleId first, then by email (link existing), then create new
    let u = await repo.findOne({ where: { googleId } })
    if (!u) {
      u = await repo.findOne({ where: { email } })
      if (u) {
        // Link existing email-based account to Google
        u.googleId = googleId!
        u.displayName = u.displayName || name || null
        u.avatarUrl = u.avatarUrl || picture || null
        await repo.save(u)
      } else {
        // Create new user
        u = repo.create({
          email,
          googleId: googleId!,
          displayName: name || null,
          avatarUrl: picture || null,
          passwordHash: null,
          role: 'user',
        })
        await repo.save(u)
      }
    }

    const token = issueToken(u)
    res.json({ token, user: userPayload(u) })
  } catch (err: any) {
    console.error('[auth/google] verification failed:', err.message)
    return res.status(401).json({ error: 'Google token verification failed' })
  }
})

router.get('/me', async (req, res) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' })

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { sub: string }
    const repo = AppDataSource.getRepository(User)
    const u = await repo.findOne({ where: { id: decoded.sub } })
    if (!u) return res.status(401).json({ error: 'user not found' })
    res.json({ user: userPayload(u) })
  } catch {
    return res.status(401).json({ error: 'invalid token' })
  }
})

// OAuth placeholders
router.get('/oauth/:provider/start', (_req, res) => res.status(501).json({ error: 'Not implemented' }))
router.get('/oauth/:provider/callback', (_req, res) => res.status(501).json({ error: 'Not implemented' }))

export default router
