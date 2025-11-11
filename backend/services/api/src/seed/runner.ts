import 'reflect-metadata'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { AppDataSource } from '../db/data-source.js'
import { User } from '../db/entities/User.js'
import { Trend } from '../db/entities/Trend.js'
import { Creator } from '../db/entities/Creator.js'
import { ContentAsset } from '../db/entities/ContentAsset.js'
import { narrativeFromTrends } from '../services/ai.js'

type TrendSeed = { label: string; tags: string[] }
type CreatorSeed = { name: string; platform: string; category: string; tags: string[] }
type AssetSeed = { name: string; tags: string[]; metadata?: any; url?: string }

function rng(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  return () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000 }
}

export async function runSeed({ dry = false, withAI = true }: { dry?: boolean; withAI?: boolean }) {
  // Find seed files relative to the project root (3 levels up from dist/src/seed, then down to seed/)
  const seedDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..', 'seed')
  const trends: TrendSeed[] = JSON.parse(fs.readFileSync(path.join(seedDir, 'trends.json'), 'utf-8'))
  const creators: CreatorSeed[] = JSON.parse(fs.readFileSync(path.join(seedDir, 'creators.json'), 'utf-8'))
  const assets: AssetSeed[] = JSON.parse(fs.readFileSync(path.join(seedDir, 'assets.json'), 'utf-8'))

  // AppDataSource already initialized by API server
  const userRepo = AppDataSource.getRepository(User)
  const trendRepo = AppDataSource.getRepository(Trend)
  const creatorRepo = AppDataSource.getRepository(Creator)
  const assetRepo = AppDataSource.getRepository(ContentAsset)

  let user = await userRepo.findOne({ where: { email: 'seed@pulse.local' } })
  if (!user && !dry) {
    user = userRepo.create({ email: 'seed@pulse.local', passwordHash: crypto.randomBytes(8).toString('hex'), role: 'admin' })
    await userRepo.save(user)
  }
  if (!user) throw new Error('No seed user and dry mode is enabled')

  await AppDataSource.query('SELECT app.set_current_user($1::uuid)', [user.id])
  const r = rng('pulse-seed')

  const trendRows: Trend[] = []
  for (const t of trends) {
    const signals = {
      tiktok: { engagement: Math.floor(500 + r() * 2000), velocity: +(0.5 + r()).toFixed(2) },
      shorts: { engagement: Math.floor(300 + r() * 1500), velocity: +(0.4 + r()).toFixed(2) },
      reels: { engagement: Math.floor(200 + r() * 1200), velocity: +(0.3 + r()).toFixed(2) }
    }
    const potential = Math.min(100, Math.round(40 + signals.tiktok.velocity * 20 + signals.shorts.velocity * 15 + signals.reels.velocity * 10))
    const longevity = Math.min(100, Math.round(35 + (signals.tiktok.engagement + signals.shorts.engagement + signals.reels.engagement) / 300))
    const resonance = Math.min(100, Math.round(40 + r() * 40))
    const velocity = Math.min(100, Math.round((signals.tiktok.velocity + signals.shorts.velocity + signals.reels.velocity) * 20))
    const metrics = { potential, longevity, resonance, velocity, tags: t.tags }
    const row = trendRepo.create({ label: t.label, signals, metrics, ownerId: user.id })
    if (!dry) await trendRepo.save(row)
    trendRows.push(row)
  }

  const creatorRows: Creator[] = []
  for (const c of creators) {
    const resonance = Math.min(100, 60 + Math.floor(r() * 40))
    const collaboration = Math.min(100, 55 + Math.floor(r() * 45))
    const metadata = { tags: c.tags, resonance, collaboration }
    const row = creatorRepo.create({ name: c.name, platform: c.platform, category: c.category, metadata, ownerId: user.id })
    if (!dry) await creatorRepo.save(row)
    creatorRows.push(row)
  }

  for (const a of assets) {
    const metadata = { ...(a.metadata || {}), tags: a.tags }
    const row = assetRepo.create({ name: a.name, url: a.url, tags: { list: a.tags }, metadata, ownerId: user.id })
    if (!dry) await assetRepo.save(row)
  }

  if (withAI) {
    const graph = { nodes: trendRows.map(tr => ({ id: tr.id, label: tr.label, kind: 'trend' as const })), links: [] }
    try { await narrativeFromTrends(graph, null) } catch {}
  }

  // Don't destroy AppDataSource - API server is still using it
  return { trends: trendRows.length, creators: creatorRows.length, assets: assets.length }
}

