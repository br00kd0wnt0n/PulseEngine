import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'

async function runMigrations() {
  console.log('[MIGRATION] Connecting to database...')

  try {
    await AppDataSource.initialize()
    console.log('[MIGRATION] Database connected')

    console.log('[MIGRATION] Running pending migrations...')
    const migrations = await AppDataSource.runMigrations()

    if (migrations.length === 0) {
      console.log('[MIGRATION] No pending migrations')
    } else {
      console.log('[MIGRATION] Successfully ran migrations:')
      migrations.forEach(m => console.log(`  - ${m.name}`))
    }

    await AppDataSource.destroy()
    console.log('[MIGRATION] Done!')
  } catch (error: any) {
    console.error('[MIGRATION] Error:', error)
    process.exit(1)
  }
}

runMigrations()
