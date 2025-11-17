import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'

async function checkSize() {
  await AppDataSource.initialize()

  const tables = ['users', 'projects', 'content_assets', 'trends', 'creators']

  console.log('=== DATABASE SIZE ===\n')

  for (const table of tables) {
    try {
      const count = await AppDataSource.query(`SELECT COUNT(*) as count FROM ${table}`)
      console.log(`${table}: ${count[0].count} rows`)
    } catch (e: any) {
      console.log(`${table}: Error - ${e.message}`)
    }
  }

  console.log('\n=== RKB SPECIFIC ===\n')
  const rkb = await AppDataSource.query(`SELECT COUNT(*) as count FROM content_assets WHERE "projectId" IS NULL`)
  console.log(`RKB assets (projectId IS NULL): ${rkb[0].count}`)

  const projectAssets = await AppDataSource.query(`SELECT COUNT(*) as count FROM content_assets WHERE "projectId" IS NOT NULL`)
  console.log(`Project assets (projectId IS NOT NULL): ${projectAssets[0].count}`)

  await AppDataSource.destroy()
}

checkSize().catch(console.error)
