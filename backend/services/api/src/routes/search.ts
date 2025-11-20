import { Router } from 'express'
import { generateEmbedding, searchSimilar } from '../services/embeddings.js'
import { AppDataSource } from '../db/data-source.js'

const router = Router()

router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (!q) return res.json({ trends: [], creators: [], assets: [] })

  try {
    // Try embedding search first
    const emb = await generateEmbedding(q)
    let trends: any[] = []
    let creators: any[] = []
    let assets: any[] = []
    if (emb) {
      ;[trends, creators, assets] = await Promise.all([
        searchSimilar('trends', emb, 10),
        searchSimilar('creators', emb, 10),
        searchSimilar('content_assets', emb, 10)
      ])
    } else {
      // Fallback keyword search
      trends = await AppDataSource.query('SELECT * FROM trends WHERE LOWER(label) LIKE LOWER($1) LIMIT 10', [`%${q}%`])
      creators = await AppDataSource.query('SELECT * FROM creators WHERE LOWER(name) LIKE LOWER($1) LIMIT 10', [`%${q}%`])
      assets = await AppDataSource.query('SELECT * FROM content_assets WHERE LOWER(name) LIKE LOWER($1) LIMIT 10', [`%${q}%`])
    }
    res.json({ trends, creators, assets })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'search failed' })
  }
})

export default router

