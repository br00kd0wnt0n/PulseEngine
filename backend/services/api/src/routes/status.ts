import { Router } from 'express'
import { AppDataSource } from '../db/data-source'

const router = Router()

router.get('/overview', async (_req, res) => {
  const db = AppDataSource
  // Counts
  const [[users], [creators], [trends], [assets]] = await Promise.all([
    db.query('SELECT count(*)::int AS c FROM users'),
    db.query('SELECT count(*)::int AS c FROM creators'),
    db.query('SELECT count(*)::int AS c FROM trends'),
    db.query('SELECT count(*)::int AS c FROM content_assets'),
  ])

  // DB size + tables
  const [[dbSize]] = await Promise.all([
    db.query("SELECT pg_database_size(current_database())::bigint AS bytes"),
  ])
  const tables = await db.query(`
    SELECT c.relname as name, pg_total_relation_size(c.oid)::bigint as bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY bytes DESC
  `)

  // Ingestion service health (optional)
  let ingestion = { ok: false, status: 'unknown' as string }
  const base = process.env.INGESTION_URL
  if (base) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 2500)
      const r = await fetch(`${base.replace(/\/$/, '')}/health`, { signal: ctrl.signal })
      clearTimeout(t)
      ingestion = { ok: r.ok, status: r.ok ? 'healthy' : `http ${r.status}` }
    } catch (e: any) {
      ingestion = { ok: false, status: e?.name === 'AbortError' ? 'timeout' : 'error' }
    }
  }

  res.json({
    services: {
      api: { ok: true, status: 'healthy' },
      ingestion,
    },
    database: {
      sizeBytes: dbSize?.bytes ?? null,
      tables,
    },
    stats: {
      users: users?.c ?? 0,
      creators: creators?.c ?? 0,
      trends: trends?.c ?? 0,
      assets: assets?.c ?? 0,
    },
  })
})

export default router

