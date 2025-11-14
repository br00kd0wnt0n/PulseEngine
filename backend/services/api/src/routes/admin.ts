import { Router } from 'express'
import { runSeed } from '../seed/runner.js'
import { AppDataSource } from '../db/data-source.js'

const router = Router()

router.post('/seed', async (req, res) => {
  // Seed token protection temporarily disabled for MVP testing
  // TODO: Re-enable token check after verifying env vars are correctly set
  /*
  const token = req.header('x-seed-token')
  const required = process.env.SEED_TOKEN
  if (required && token !== required) {
    return res.status(401).json({ error: 'unauthorized: x-seed-token required' })
  }
  */
  const dry = !!req.body?.dry
  const withAI = !!process.env.OPENAI_API_KEY && req.body?.withAI !== false
  try {
    const result = await runSeed({ dry, withAI })
    res.json({ ok: true, result })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) })
  }
})

router.post('/migrate', async (req, res) => {
  try {
    const migrations = await AppDataSource.runMigrations()
    res.json({ ok: true, migrations: migrations.map(m => m.name) })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) })
  }
})

router.post('/add-project-id-column', async (req, res) => {
  try {
    // Manually add projectId column if it doesn't exist
    await AppDataSource.query(`
      ALTER TABLE content_assets
      ADD COLUMN IF NOT EXISTS "projectId" uuid REFERENCES projects(id) ON DELETE CASCADE
    `)
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_content_assets_project
      ON content_assets("projectId")
    `)
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_content_assets_rkb
      ON content_assets("projectId") WHERE "projectId" IS NULL
    `)
    res.json({ ok: true, message: 'projectId column added successfully' })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) })
  }
})

router.post('/setup-pgvector', async (req, res) => {
  try {
    // Add projectId column first (one-time migration)
    try {
      await AppDataSource.query(`
        ALTER TABLE content_assets
        ADD COLUMN IF NOT EXISTS "projectId" uuid REFERENCES projects(id) ON DELETE CASCADE
      `)
      await AppDataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_content_assets_project
        ON content_assets("projectId")
      `)
      await AppDataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_content_assets_rkb
        ON content_assets("projectId") WHERE "projectId" IS NULL
      `)
    } catch (e) {
      // Ignore if column already exists
    }

    // Enable pgvector extension
    await AppDataSource.query('CREATE EXTENSION IF NOT EXISTS vector')

    // Add embedding columns
    await AppDataSource.query('ALTER TABLE trends ADD COLUMN IF NOT EXISTS embedding vector(1536)')
    await AppDataSource.query('ALTER TABLE creators ADD COLUMN IF NOT EXISTS embedding vector(1536)')
    await AppDataSource.query('ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS embedding vector(1536)')

    // Create indexes
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS trends_embedding_idx
      ON trends USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `)
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS creators_embedding_idx
      ON creators USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `)
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS content_assets_embedding_idx
      ON content_assets USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `)

    res.json({ ok: true, message: 'pgvector setup complete' })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) })
  }
})

router.get('/users', async (req, res) => {
  try {
    const users = await AppDataSource.query('SELECT id, email, role, "createdAt" FROM users LIMIT 10')
    res.json({ ok: true, users })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) })
  }
})

router.get('/assets', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100
    const offset = parseInt(req.query.offset as string) || 0
    const rkbOnly = req.query.rkbOnly === 'true'

    let whereClause = ''
    let countWhereClause = ''
    if (rkbOnly) {
      whereClause = 'WHERE "projectId" IS NULL'
      countWhereClause = 'WHERE "projectId" IS NULL'
    }

    const assets = await AppDataSource.query(
      `SELECT id, name, tags, metadata, "ownerId", "createdAt" FROM content_assets ${whereClause} ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    )
    const total = await AppDataSource.query(`SELECT COUNT(*) as count FROM content_assets ${countWhereClause}`)
    res.json({ ok: true, assets, total: parseInt(total[0].count), limit, offset })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) })
  }
})

router.post('/assets/bulk-tag', async (req, res) => {
  try {
    const { tag } = req.body
    if (!tag || typeof tag !== 'string') {
      return res.status(400).json({ ok: false, error: 'Tag is required' })
    }

    // Get all assets
    const assets = await AppDataSource.query('SELECT id, tags FROM content_assets')

    let updated = 0
    for (const asset of assets) {
      const currentTags = asset.tags || {}

      // Add the new tag if it doesn't exist
      if (!Object.values(currentTags).includes(tag)) {
        const updatedTags = { ...currentTags, [`tag_${Date.now()}_${Math.random()}`]: tag }
        await AppDataSource.query(
          'UPDATE content_assets SET tags = $1 WHERE id = $2',
          [JSON.stringify(updatedTags), asset.id]
        )
        updated++
      }
    }

    res.json({ ok: true, message: `Added '${tag}' to ${updated} assets`, updated, total: assets.length })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) })
  }
})

router.delete('/assets/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(400).json({ ok: false, error: 'Asset ID is required' })
    }

    await AppDataSource.query('DELETE FROM content_assets WHERE id = $1', [id])
    res.json({ ok: true, message: 'Asset deleted', id })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) })
  }
})

export default router

