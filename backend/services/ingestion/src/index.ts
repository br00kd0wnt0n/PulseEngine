import 'reflect-metadata'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import multer from 'multer'
import dotenv from 'dotenv'
import pino from 'pino'
import pinoHttp from 'pino-http'
import { DataSource } from 'typeorm'
import { ContentAsset } from './entities/ContentAsset'

dotenv.config()
const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' })
const upload = multer({ storage: multer.memoryStorage() })

const ds = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL, entities: [ContentAsset] })

async function main() {
  await ds.initialize()
  const app = express()
  app.use(helmet())
  app.use(cors())
  app.use(express.json({ limit: '4mb' }))
  app.use(pinoHttp({ logger }))

  app.get('/health', (_req, res) => res.json({ ok: true }))

  // URL parsing and social link extraction (lightweight placeholder)
  app.post('/ingest/url', async (req, res) => {
    const { url, ownerId } = req.body || {}
    if (!url || !ownerId) return res.status(400).json({ error: 'url and ownerId required' })
    await ds.query('SELECT app.set_current_user($1::uuid)', [ownerId])
    const parsed = parseUrl(url)
    const repo = ds.getRepository(ContentAsset)
    const a = repo.create({ name: parsed.title, url, tags: parsed.tags, metadata: parsed.metadata, ownerId })
    await repo.save(a)
    res.status(201).json(a)
  })

  // Multi-format upload support (stored elsewhere; we persist metadata only)
  app.post('/ingest/upload', upload.array('files'), async (req, res) => {
    const ownerId = (req.body?.ownerId as string) || ''
    if (!ownerId) return res.status(400).json({ error: 'ownerId required' })
    await ds.query('SELECT app.set_current_user($1::uuid)', [ownerId])
    const files = (req.files as Express.Multer.File[]) || []
    const repo = ds.getRepository(ContentAsset)
    const saved = [] as ContentAsset[]
    for (const f of files) {
      const meta = analyzeBuffer(f)
      const a = repo.create({ name: f.originalname, url: null, tags: meta.tags, metadata: meta.metadata, ownerId })
      saved.push(await repo.save(a))
    }
    res.status(201).json(saved)
  })

  // PDF/document analysis placeholder
  app.post('/ingest/pdf', upload.single('file'), async (req, res) => {
    const ownerId = (req.body?.ownerId as string) || ''
    if (!ownerId || !req.file) return res.status(400).json({ error: 'ownerId and file required' })
    await ds.query('SELECT app.set_current_user($1::uuid)', [ownerId])
    const meta = { tags: { type: 'pdf' }, metadata: { bytes: req.file.size } }
    const repo = ds.getRepository(ContentAsset)
    const a = repo.create({ name: req.file.originalname, tags: meta.tags, metadata: meta.metadata, ownerId })
    await repo.save(a)
    res.status(201).json(a)
  })

  const port = Number(process.env.PORT || 8081)
  app.listen(port, () => logger.info(`Ingestion listening on ${port}`))
}

function parseUrl(url: string) {
  const u = new URL(url)
  const host = u.hostname.replace('www.', '')
  const title = host + (u.pathname ? `:${u.pathname}` : '')
  const tags: Record<string, any> = { host, path: u.pathname }
  const metadata: Record<string, any> = {}
  if (/tiktok|youtube|instagram|x\.com|twitter/.test(host)) tags.platform = 'social'
  return { title, tags, metadata }
}

function analyzeBuffer(f: Express.Multer.File) {
  const ext = (f.originalname.split('.').pop() || '').toLowerCase()
  const type = f.mimetype
  const tags: Record<string, any> = { ext, type }
  const metadata: Record<string, any> = { bytes: f.size }
  return { tags, metadata }
}

main().catch((e) => { logger.error(e, 'Fatal'); process.exit(1) })
