import { AppDataSource } from '../db/data-source.js'
import { TrendSummary } from '../db/entities/TrendSummary.js'

type Period = 'day' | 'week' | 'month'

function windowFor(period: Period): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date()
  if (period === 'day') start.setDate(end.getDate() - 1)
  else if (period === 'week') start.setDate(end.getDate() - 7)
  else start.setDate(end.getDate() - 30)
  return { start, end }
}

function scoreMetric(m: any): number {
  const wE = Number(process.env.TREND_WEIGHT_ENGAGEMENT || 1)
  const wV = Number(process.env.TREND_WEIGHT_VELOCITY || 1)
  const e = Number(m.engagement || 0)
  const v = Number(m.velocity || 0)
  return wE * e + wV * v
}

export async function buildTrendSummaries(periods: Period[] = ['day','week','month'], perPlatform: number = Number(process.env.TREND_SUMMARY_ITEMS || 20)) {
  for (const p of periods) {
    const { start, end } = windowFor(p)
    const platforms = ['tiktok','instagram','youtube','news']
    for (const platform of platforms) {
      const rows = await AppDataSource.query(`
        SELECT platform, metric_type, value, engagement, velocity, metadata, "createdAt"
        FROM platform_metrics
        WHERE platform = $1 AND "createdAt" >= $2 AND "createdAt" <= $3
        ORDER BY engagement DESC, velocity DESC
        LIMIT 2000
      `, [platform, start, end])
      // Deduplicate similar items by (platform,type,label bucketed by hour)
      const seen = new Set<string>()
      const ranked = [] as any[]
      rows
        .map((m: any, idx: number) => ({ m, idx, score: scoreMetric(m) }))
        .sort((a: any, b: any) => b.score - a.score)
        .forEach(({ m }: any) => {
          const s = simplifyMetric(m)
          const bucket = s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 13) : 'na'
          const sig = `${(s.platform||'').toLowerCase()}|${(s.type||'').toLowerCase()}|${(s.label||'').toLowerCase().slice(0,48)}|${bucket}`
          if (!seen.has(sig)) { seen.add(sig); ranked.push(s) }
        })
      const top = ranked.slice(0, perPlatform)

      const payload = { items: top, meta: { period: p, platform, windowStart: start.toISOString(), windowEnd: end.toISOString(), updatedAt: new Date().toISOString() } }
      await upsertSummary(p, platform, start, end, payload)
    }

    // Global rollup (all platforms)
    const allRows = await AppDataSource.query(`
      SELECT platform, metric_type, value, engagement, velocity, metadata, "createdAt"
      FROM platform_metrics
      WHERE "createdAt" >= $1 AND "createdAt" <= $2
      ORDER BY engagement DESC, velocity DESC
      LIMIT 4000
    `, [start, end])
    const seenAll = new Set<string>()
    const dedupAll: any[] = []
    allRows
      .map((m: any) => ({ m, score: scoreMetric(m) }))
      .sort((a: any, b: any) => b.score - a.score)
      .forEach(({ m }: any) => {
        const s = simplifyMetric(m)
        const bucket = s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 13) : 'na'
        const sig = `${(s.platform||'').toLowerCase()}|${(s.type||'').toLowerCase()}|${(s.label||'').toLowerCase().slice(0,48)}|${bucket}`
        if (!seenAll.has(sig)) { seenAll.add(sig); dedupAll.push(s) }
      })
    const rankedAll = dedupAll.slice(0, perPlatform)
    const allPayload = { items: rankedAll, meta: { period: p, platform: 'all', windowStart: start.toISOString(), windowEnd: end.toISOString(), updatedAt: new Date().toISOString() } }
    await upsertSummary(p, 'all', start, end, allPayload)
  }
}

async function upsertSummary(period: Period, platform: string, windowStart: Date, windowEnd: Date, payload: any) {
  await AppDataSource.getRepository(TrendSummary).upsert({
    period,
    platform,
    windowStart,
    windowEnd,
    payload,
  }, ['period','platform','windowStart'])
}

function simplifyMetric(metric: any) {
  const platform = metric.platform
  const type = metric.metric_type
  const createdAt = metric.createdAt
  const engagement = metric.engagement || 0
  const velocity = metric.velocity || 0
  const value = metric.value || {}
  const label = value.hashtag || value.title || (value.caption ? String(value.caption).slice(0, 100) : '')
  return { platform, type, label, engagement, velocity, createdAt, value }
}

export async function getTrendSummary(period: Period, platform: string) {
  const repo = AppDataSource.getRepository(TrendSummary)
  const row = await repo.findOne({ where: { period, platform }, order: { windowStart: 'DESC' as any } })
  return row?.payload || { items: [], meta: {} }
}
