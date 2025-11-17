import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'

async function setupPgvector() {
  console.log('Setting up pgvector extension and embedding columns...\n')
  await AppDataSource.initialize()

  try {
    // 1. Enable pgvector extension
    console.log('1. Creating vector extension...')
    await AppDataSource.query(`CREATE EXTENSION IF NOT EXISTS vector`)
    console.log('   ✅ Vector extension created\n')

    // 2. Add embedding columns
    console.log('2. Adding embedding columns...')

    await AppDataSource.query(`
      ALTER TABLE trends
      ADD COLUMN IF NOT EXISTS embedding vector(1536)
    `)
    console.log('   ✅ Added embedding to trends')

    await AppDataSource.query(`
      ALTER TABLE creators
      ADD COLUMN IF NOT EXISTS embedding vector(1536)
    `)
    console.log('   ✅ Added embedding to creators')

    await AppDataSource.query(`
      ALTER TABLE content_assets
      ADD COLUMN IF NOT EXISTS embedding vector(1536)
    `)
    console.log('   ✅ Added embedding to content_assets\n')

    // 3. Create indexes (need at least 1000 rows for IVFFlat, so skip for empty tables)
    console.log('3. Creating vector indexes...')

    try {
      await AppDataSource.query(`
        CREATE INDEX IF NOT EXISTS trends_embedding_idx
        ON trends USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `)
      console.log('   ✅ Created index on trends')
    } catch (err: any) {
      console.log('   ⚠️  Skipped trends index:', err.message)
    }

    try {
      await AppDataSource.query(`
        CREATE INDEX IF NOT EXISTS creators_embedding_idx
        ON creators USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `)
      console.log('   ✅ Created index on creators')
    } catch (err: any) {
      console.log('   ⚠️  Skipped creators index:', err.message)
    }

    try {
      await AppDataSource.query(`
        CREATE INDEX IF NOT EXISTS content_assets_embedding_idx
        ON content_assets USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `)
      console.log('   ✅ Created index on content_assets')
    } catch (err: any) {
      console.log('   ⚠️  Skipped content_assets index:', err.message)
    }

    // 4. Mark migration as executed in migrations table
    console.log('\n4. Recording migration...')
    await AppDataSource.query(`
      INSERT INTO migrations (timestamp, name)
      VALUES ('1710000004000', 'VectorEmbeddings1710000004000')
      ON CONFLICT DO NOTHING
    `)
    console.log('   ✅ Migration recorded\n')

    console.log('✅ pgvector setup complete!\n')

  } catch (err: any) {
    console.error('❌ Error:', err.message)
    if (err.detail) console.error('   Detail:', err.detail)
    process.exit(1)
  }

  await AppDataSource.destroy()
}

setupPgvector().catch(console.error)
