import 'reflect-metadata'
import { AppDataSource } from '../db/data-source'

async function run() {
  await AppDataSource.initialize()
  await AppDataSource.runMigrations()
  await AppDataSource.destroy()
  console.log('Migrations applied')
}
run().catch((e) => { console.error(e); process.exit(1) })

