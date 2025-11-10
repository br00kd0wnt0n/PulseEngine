import { Router } from 'express'
import multer from 'multer'
import { AppDataSource } from '../db/data-source.js'
import { ContentAsset } from '../db/entities/ContentAsset.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

// URL parsing and social link extraction
router.post('/url', async (req, res) => {
  const { url, ownerId } = req.body || {}
  if (!url || !ownerId) return res.status(400).json({ error: 'url and ownerId required' })

  await AppDataSource.query('SELECT app.set_current_user($1::uuid)', [ownerId])

  const parsed = parseUrl(url)
  const repo = AppDataSource.getRepository(ContentAsset)
  const asset = repo.create({
    name: parsed.title,
    url,
    tags: parsed.tags,
    metadata: parsed.metadata,
    ownerId
  })
  await repo.save(asset)
  res.status(201).json(asset)
})

// Multi-format upload support (stored elsewhere; we persist metadata only)
router.post('/upload', upload.array('files'), async (req, res) => {
  const ownerId = (req.body?.ownerId as string) || ''
  if (!ownerId) return res.status(400).json({ error: 'ownerId required' })

  await AppDataSource.query('SELECT app.set_current_user($1::uuid)', [ownerId])

  const files = (req.files as Express.Multer.File[]) || []
  const repo = AppDataSource.getRepository(ContentAsset)
  const saved: ContentAsset[] = []

  for (const f of files) {
    const meta = analyzeBuffer(f)
    const asset = repo.create({
      name: f.originalname,
      url: undefined,
      tags: meta.tags,
      metadata: meta.metadata,
      ownerId
    })
    saved.push(await repo.save(asset))
  }

  res.status(201).json(saved)
})

// PDF/document analysis placeholder
router.post('/pdf', upload.single('file'), async (req, res) => {
  const ownerId = (req.body?.ownerId as string) || ''
  if (!ownerId || !req.file) {
    return res.status(400).json({ error: 'ownerId and file required' })
  }

  await AppDataSource.query('SELECT app.set_current_user($1::uuid)', [ownerId])

  const meta = {
    tags: { type: 'pdf' },
    metadata: { bytes: req.file.size }
  }
  const repo = AppDataSource.getRepository(ContentAsset)
  const asset = repo.create({
    name: req.file.originalname,
    tags: meta.tags,
    metadata: meta.metadata,
    ownerId
  })
  await repo.save(asset)
  res.status(201).json(asset)
})

// Helper functions
function parseUrl(url: string) {
  const u = new URL(url)
  const host = u.hostname.replace('www.', '')
  const title = host + (u.pathname ? `:${u.pathname}` : '')
  const tags: Record<string, any> = { host, path: u.pathname }
  const metadata: Record<string, any> = {}
  if (/tiktok|youtube|instagram|x\.com|twitter/.test(host)) {
    tags.platform = 'social'
  }
  return { title, tags, metadata }
}

function analyzeBuffer(f: Express.Multer.File) {
  const ext = (f.originalname.split('.').pop() || '').toLowerCase()
  const type = f.mimetype
  const tags: Record<string, any> = { ext, type }
  const metadata: Record<string, any> = { bytes: f.size }
  return { tags, metadata }
}

export default router
