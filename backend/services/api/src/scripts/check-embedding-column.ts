import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'

async function checkEmbeddingColumn() {
  await AppDataSource.initialize()

  console.log('Checking for embedding column in content_assets table...\n')

  // Check if embedding column exists
  const columnCheck = await AppDataSource.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'content_assets'
    ORDER BY ordinal_position
  `)

  console.log('Columns in content_assets:')
  console.table(columnCheck.map((c: any) => ({
    name: c.column_name,
    type: c.data_type,
    udt: c.udt_name
  })))

  const hasEmbedding = columnCheck.find((c: any) => c.column_name === 'embedding')

  if (hasEmbedding) {
    console.log(`\n✅ Embedding column exists with type: ${hasEmbedding.udt_name}`)
  } else {
    console.log('\n❌ Embedding column does NOT exist')
  }

  await AppDataSource.destroy()
}

checkEmbeddingColumn().catch(console.error)
