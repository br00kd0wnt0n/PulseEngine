import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'

async function addProjectIdColumn() {
  console.log('Adding projectId column to content_assets...\n')
  await AppDataSource.initialize()

  try {
    // Add nullable projectId column
    console.log('1. Adding projectId column...')
    await AppDataSource.query(`
      ALTER TABLE content_assets
      ADD COLUMN IF NOT EXISTS "projectId" uuid REFERENCES projects(id) ON DELETE CASCADE
    `)
    console.log('   ✅ projectId column added\n')

    // Create indexes
    console.log('2. Creating indexes...')
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_content_assets_project
      ON content_assets("projectId")
    `)
    console.log('   ✅ Created project index')

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_content_assets_rkb
      ON content_assets("projectId") WHERE "projectId" IS NULL
    `)
    console.log('   ✅ Created RKB index\n')

    // Mark migration as executed
    console.log('3. Recording migration...')
    await AppDataSource.query(`
      INSERT INTO migrations (timestamp, name)
      VALUES ('1710000005000', 'ContentAssetsProjectId1710000005000')
      ON CONFLICT DO NOTHING
    `)
    console.log('   ✅ Migration recorded\n')

    console.log('✅ projectId migration complete!\n')

  } catch (err: any) {
    console.error('❌ Error:', err.message)
    if (err.detail) console.error('   Detail:', err.detail)
    process.exit(1)
  }

  await AppDataSource.destroy()
}

addProjectIdColumn().catch(console.error)
