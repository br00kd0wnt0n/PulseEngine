import 'reflect-metadata'
import { DataSource } from 'typeorm'

const NEW_DATABASE_URL = process.env.NEW_DATABASE_URL

if (!NEW_DATABASE_URL) {
  console.error('❌ Missing NEW_DATABASE_URL')
  process.exit(1)
}

async function testConnection() {
  console.log('Testing connection to new pgvector database...\n')
  console.log('URL:', NEW_DATABASE_URL!.replace(/:[^:@]+@/, ':***@'))

  const db = new DataSource({
    type: 'postgres',
    url: NEW_DATABASE_URL,
    entities: [],
    synchronize: false
  })

  try {
    await db.initialize()
    console.log('✅ Connection successful!\n')

    // Check if pgvector is available
    const extensions = await db.query(
      `SELECT name FROM pg_available_extensions WHERE name LIKE '%vector%' ORDER BY name`
    )

    if (extensions.length > 0) {
      console.log('✅ Vector extensions available:')
      extensions.forEach((ext: any) => console.log(`   - ${ext.name}`))
    } else {
      console.log('❌ No vector extensions found')
    }

    await db.destroy()
  } catch (err: any) {
    console.error('❌ Connection failed:', err.message)
    process.exit(1)
  }
}

testConnection()
