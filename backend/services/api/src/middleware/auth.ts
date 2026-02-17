import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { AppDataSource } from '../db/data-source.js'

export type JwtClaims = { sub: string; role: 'user' | 'admin'; email: string }

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing token' })
  try {
    const secret = process.env.JWT_SECRET
    if (!secret) return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET not set' })
    const claims = jwt.verify(token, secret) as JwtClaims
    ;(req as any).user = claims
    return next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export async function attachRls(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user as JwtClaims
  if (!user) return next()
  await AppDataSource.query(`SELECT app.set_current_user($1::uuid)`, [user.sub])
  next()
}

