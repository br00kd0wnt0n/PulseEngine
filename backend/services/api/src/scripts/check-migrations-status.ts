import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'

async function checkMigrations() {
  await AppDataSource.initialize()

  console.log('Checking which migrations have been executed...\n')

  try {
    const migrations = await AppDataSource.query(`
      SELECT * FROM migrations ORDER BY timestamp
    `)

    if (migrations.length > 0) {
      console.log('Executed migrations:')
      console.table(migrations.map((m: any) => ({
        timestamp: m.timestamp,
        name: m.name
      })))
    } else {
      console.log('❌ No migrations have been executed yet')
    }
  } catch (err: any) {
    console.error('❌ Error:', err.message)
    if (err.message.includes('relation "migrations" does not exist')) {
      console.log('\n💡 The migrations table does not exist. TypeORM migrations may not have run.')
    }
  }

  await AppDataSource.destroy()
}

checkMigrations().catch(console.error)
