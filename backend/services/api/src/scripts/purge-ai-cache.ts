import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'
import { AICache } from '../db/entities/AICache.js'

type Args = {
  all?: boolean
  prefix?: string
  contains?: string
  olderDays?: number
  yes?: boolean
  confirm?: string
}

function parseArgs(argv: string[]): Args {
  const out: Args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--all') out.all = true
    else if (a === '--yes' || a === '-y') out.yes = true
    else if (a === '--confirm') { out.confirm = argv[++i] }
    else if (a === '--prefix') { out.prefix = argv[++i] }
    else if (a === '--contains') { out.contains = argv[++i] }
    else if (a === '--older-days') { out.olderDays = parseInt(argv[++i] || 'NaN', 10) }
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv)
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set')
    process.exit(2)
  }

  if (args.all && args.confirm !== 'DELETE_ALL_AI_CACHE') {
    console.error('Refusing to purge everything without --confirm DELETE_ALL_AI_CACHE')
    process.exit(2)
  }
  if (!args.all && !args.prefix && !args.contains && !Number.isFinite(args.olderDays || NaN)) {
    console.log('Usage: ts-node-esm src/scripts/purge-ai-cache.ts [--all --confirm DELETE_ALL_AI_CACHE] [--prefix k] [--contains s] [--older-days N] [--yes]')
    process.exit(1)
  }

  await AppDataSource.initialize()
  const repo = AppDataSource.getRepository(AICache)

  const whereParts: string[] = []
  const params: any[] = []
  if (args.all) {
    // no where
  } else {
    if (args.prefix) { whereParts.push('key LIKE $' + (params.length + 1)); params.push(args.prefix + '%') }
    if (args.contains) { whereParts.push('key LIKE $' + (params.length + 1)); params.push('%' + args.contains + '%') }
    if (Number.isFinite(args.olderDays || NaN)) {
      whereParts.push('"createdAt" < NOW() - ($' + (params.length + 1) + ')::interval')
      params.push(`${args.olderDays} days`)
    }
  }
  const whereSql = whereParts.length ? ('WHERE ' + whereParts.join(' AND ')) : ''

  const countSql = `SELECT COUNT(*)::int AS c FROM ai_cache ${whereSql}`
  const [{ c }] = await AppDataSource.query(countSql, params)
  console.log(`[AICache] Matching keys: ${c}`)
  if (!c) { await AppDataSource.destroy(); process.exit(0) }

  const samples = await AppDataSource.query(`SELECT key, "createdAt" FROM ai_cache ${whereSql} ORDER BY "createdAt" DESC LIMIT 5`, params)
  console.log('[AICache] Sample keys:')
  for (const s of samples) console.log(' -', s.key)

  if (!args.yes) {
    console.log('Add --yes to proceed with deletion')
    await AppDataSource.destroy()
    process.exit(1)
  }

  const delSql = `DELETE FROM ai_cache ${whereSql}`
  const result = await AppDataSource.query(delSql, params)
  // result[1] may not be reliable across drivers; re-count
  const [{ c: after }] = await AppDataSource.query(countSql, params)
  console.log(`[AICache] Purge complete. Remaining matching keys: ${after}`)

  await AppDataSource.destroy()
}

main().catch(async (e) => { console.error(e); try { await AppDataSource.destroy() } catch {}; process.exit(1) })

