import { Router } from 'express'
import { AppDataSource } from '../db/data-source.js'

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

  // Trends job status: last run inferred from most recent trend row
  let trendsJob: any = { ok: true, lastRun: null, count: 0, storageBytes: 0 }
  try {
    const [row] = await db.query('SELECT MAX("createdAt") as last, COUNT(*)::int as cnt FROM trends')
    trendsJob.lastRun = row?.last || null
    trendsJob.count = row?.cnt || 0
    const trendsTable = (tables || []).find((t: any) => t.name === 'trends')
    trendsJob.storageBytes = trendsTable?.bytes || 0
  } catch (e) {
    // keep defaults
  }

  // Apify agents: real fetch if env present; else placeholder
  let agents: any[] = []
  try {
    const token = process.env.APIFY_API_TOKEN
    // If no APIFY_ACTOR_IDS env, use the 7 actors configured in apify.ts
    const defaultActors = [
      'clockworks/tiktok-hashtag-scraper',
      'apify/instagram-hashtag-scraper',
      'apidojo/tweet-scraper',
      'streamers/youtube-scraper',
      'lhotanova/google-news-scraper',
      'jupri/wiki-scraper',
      'kuaima/Fandom'
    ]
    const ids = (process.env.APIFY_ACTOR_IDS || defaultActors.join(',')).split(',').map(s => s.trim()).filter(Boolean)
    if (token && ids.length) {
      agents = await Promise.all(ids.map(async (id) => {
        try {
          const actResp = await fetch(`https://api.apify.com/v2/acts/${id}`)
          const act = await actResp.json()
          const runsResp = await fetch(`https://api.apify.com/v2/acts/${id}/runs?token=${token}&limit=1&desc=true`)
          const runs = await runsResp.json()
          const last = runs?.data?.items?.[0]
          return {
            name: act?.data?.title || id,
            ok: last?.status === 'SUCCEEDED',
            status: last?.status || 'unknown',
            lastRun: last?.startedAt || null,
            issues: last?.status === 'FAILED' ? [last?.errorMessage || 'Run failed'] : [],
          }
        } catch (e: any) {
          return { name: id, ok: false, status: 'error', lastRun: null, issues: [e?.message || 'fetch error'] }
        }
      }))
    } else {
      agents = Array.from({ length: 7 }).map((_, i) => ({
        name: `Agent #${i + 1}`,
        ok: true,
        status: 'idle',
        lastRun: trendsJob.lastRun,
        issues: [],
      }))
    }
  } catch {
    agents = Array.from({ length: 7 }).map((_, i) => ({ name: `Agent #${i + 1}`, ok: true, status: 'idle', lastRun: trendsJob.lastRun, issues: [] }))
  }

  const ai = {
    ok: !!process.env.OPENAI_API_KEY,
    model: process.env.MODEL_NAME || 'gpt-4o-mini',
    provider: process.env.OPENAI_API_KEY ? 'OpenAI' : 'unset',
  }
  const ingestion = {
    ok: !!process.env.INGESTION_URL,
    status: process.env.INGESTION_URL ? 'configured' : 'not configured',
  }

  res.json({
    services: {
      api: { ok: true, status: 'healthy' },
      ingestion,
      ai,
    },
    database: {
      sizeBytes: dbSize?.bytes ?? null,
      tables,
    },
    trends: { job: trendsJob, agents },
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

  res.json({
    ok: issues.length === 0,
    issues,
    env,
    db: { ok: dbOk, schema, rls },
  })
})

export default router
