import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'

async function checkPostgres() {
  await AppDataSource.initialize()

  // Check Postgres version
  const version = await AppDataSource.query('SELECT version()')
  console.log('Postgres Version:')
  console.log(version[0].version)
  console.log()

  // Check available extensions
  console.log('Available Extensions:')
  const extensions = await AppDataSource.query(
    `SELECT name FROM pg_available_extensions WHERE name LIKE '%vector%' ORDER BY name`
  )

  if (extensions.length > 0) {
    console.log('✅ Vector extensions available:')
    extensions.forEach((ext: any) => console.log(`  - ${ext.name}`))
  } else {
    console.log('❌ No vector extensions found')
  }
  console.log()

  // Check installed extensions
  console.log('Currently Installed Extensions:')
  const installed = await AppDataSource.query(
    `SELECT extname, extversion FROM pg_extension ORDER BY extname`
  )

  if (installed.length > 0) {
    console.table(installed.map((e: any) => ({ name: e.extname, version: e.extversion })))
  } else {
    console.log('No extensions installed')
  }

  await AppDataSource.destroy()
}

checkPostgres().catch(console.error)
