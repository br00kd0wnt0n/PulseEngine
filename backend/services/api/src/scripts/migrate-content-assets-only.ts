import 'reflect-metadata'
import { DataSource } from 'typeorm'

const OLD_DATABASE_URL = process.env.OLD_DATABASE_URL
const NEW_DATABASE_URL = process.env.NEW_DATABASE_URL

if (!OLD_DATABASE_URL || !NEW_DATABASE_URL) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const oldDB = new DataSource({
  type: 'postgres',
  url: OLD_DATABASE_URL,
  entities: [],
  synchronize: false
})

const newDB = new DataSource({
  type: 'postgres',
  url: NEW_DATABASE_URL,
  entities: [],
  synchronize: false
})

async function migrateContentAssets() {
  console.log('Migrating content_assets from old to new database...\n')

  await oldDB.initialize()
  await newDB.initialize()

  try {
    // Get all content_assets from old DB
    const assets = await oldDB.query(`SELECT * FROM content_assets ORDER BY "createdAt"`)
    console.log(`Found ${assets.length} content_assets in old database\n`)

    // Check how many already exist in new DB
    const existing = await newDB.query(`SELECT COUNT(*) as count FROM content_assets`)
    console.log(`Currently ${existing[0].count} content_assets in new database\n`)

    let copied = 0
    let skipped = 0
    let errors = 0

    for (const asset of assets) {
      try {
        await newDB.query(`
          INSERT INTO content_assets (
            id, name, url, tags, metadata, "ownerId", "createdAt", "updatedAt", "projectId", embedding
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO NOTHING
        `, [
          asset.id,
          asset.name,
          asset.url,
          JSON.stringify(asset.tags),
          JSON.stringify(asset.metadata),
          asset.ownerId,
          asset.createdAt,
          asset.updatedAt,
          asset.projectId || null,
          asset.embedding || null
        ])
        copied++
        if (copied % 10 === 0) {
          process.stdout.write(`\rCopied ${copied}/${assets.length} assets...`)
        }
      } catch (err: any) {
        if (err.code === '23505') { // Duplicate key
          skipped++
        } else {
          errors++
          console.error(`\n❌ Error migrating ${asset.name}:`, err.message)
        }
      }
    }

    console.log(`\n\n✅ Migration complete!`)
    console.log(`   Copied: ${copied}`)
    console.log(`   Skipped: ${skipped}`)
    console.log(`   Errors: ${errors}\n`)

    // Verify
    const final = await newDB.query(`SELECT COUNT(*) as count FROM content_assets`)
    console.log(`📊 Total content_assets in new database: ${final[0].count}\n`)

  } catch (err: any) {
    console.error('❌ Fatal error:', err.message)
    process.exit(1)
  }

  await oldDB.destroy()
  await newDB.destroy()
}

migrateContentAssets().catch(console.error)
