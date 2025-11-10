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

router.get('/preflight', async (_req, res) => {
  const issues: string[] = []
  const env = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    JWT_SECRET: !!process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV || 'unknown',
    INGESTION_URL: !!process.env.INGESTION_URL,
  }

  for (const [k, v] of Object.entries(env)) if (!v || v === 'unknown') issues.push(`env:${k} missing`)

  // DB connectivity + schema checks
  let dbOk = false
  let schema: any = {}
  let rls = { hasFunc: false }
  try {
    const [ok] = await AppDataSource.query('SELECT 1 as ok')
    dbOk = ok?.ok === 1
    const [tbls] = await AppDataSource.query(`
      SELECT
        (to_regclass('public.users') IS NOT NULL) AS users,
        (to_regclass('public.creators') IS NOT NULL) AS creators,
        (to_regclass('public.trends') IS NOT NULL) AS trends,
        (to_regclass('public.content_assets') IS NOT NULL) AS assets
    `)
    schema = tbls || {}
    const [func] = await AppDataSource.query(`SELECT to_regprocedure('app.set_current_user(uuid)') IS NOT NULL AS exists`)
    rls.hasFunc = !!(func && func.exists)
    if (!schema.users) issues.push('db:users table missing')
    if (!schema.creators) issues.push('db:creators table missing')
    if (!schema.trends) issues.push('db:trends table missing')
    if (!schema.assets) issues.push('db:content_assets table missing')
    if (!rls.hasFunc) issues.push('db:rls function app.set_current_user missing')
  } catch (e: any) {
    issues.push(`db:error ${e?.message || e}`)
  }

  // Ingestion health
  let ingestion = { ok: false, status: 'unset' as string }
  if (process.env.INGESTION_URL) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 2500)
      const r = await fetch(`${process.env.INGESTION_URL!.replace(/\/$/, '')}/health`, { signal: ctrl.signal })
      clearTimeout(t)
      ingestion = { ok: r.ok, status: r.ok ? 'healthy' : `http ${r.status}` }
      if (!r.ok) issues.push(`ingestion:${ingestion.status}`)
    } catch (e: any) {
      ingestion = { ok: false, status: 'unreachable' }
      issues.push('ingestion:unreachable')
    }
  }

  res.json({
    ok: issues.length === 0,
    issues,
    env,
    db: { ok: dbOk, schema, rls },
    services: { ingestion },
  })
})

export default router
