import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'
import { generateEmbedding } from '../services/embeddings.js'

/**
 * Test embedding generation for a single RKB asset
 */

async function testSingleEmbedding() {
  console.log('=== TEST SINGLE RKB EMBEDDING ===\n')

  // Initialize database connection
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize()
  }

  // Get one RKB asset without embedding
  const assets = await AppDataSource.query(`
    SELECT id, name, metadata, "createdAt"
    FROM content_assets
    WHERE "projectId" IS NULL
      AND embedding IS NULL
    LIMIT 1
  `)

  if (assets.length === 0) {
    console.log('No RKB assets found without embeddings')
    await AppDataSource.destroy()
    process.exit(0)
  }

  const asset = assets[0]
  console.log('📄 Testing with asset:')
  console.log(`   ID: ${asset.id}`)
  console.log(`   Name: ${asset.name}`)
  console.log(`   Created: ${asset.createdAt}`)
  console.log(`   Metadata: ${JSON.stringify(asset.metadata, null, 2)}\n`)

  // Extract info from filename
  // Pattern: "2025-11-14T12-27-15_COMPANY_Topic.pdf"
  const parts = asset.name.split('_')
  const company = parts[1] || ''
  const topic = parts.slice(2).join(' ').replace('.pdf', '').replace('.jpg', '')

  console.log('📝 Extracted from filename:')
  console.log(`   Company: ${company}`)
  console.log(`   Topic: ${topic}\n`)

  // Generate embedding text
  const embeddingText = `${topic} ${company} industry trends report analysis`
  console.log('🔤 Embedding text:')
  console.log(`   "${embeddingText}"\n`)

  // Generate embedding
  console.log('🔄 Generating embedding via OpenAI...')
  const embedding = await generateEmbedding(embeddingText)

  if (!embedding) {
    console.log('❌ Failed to generate embedding (check OPENAI_API_KEY)')
    await AppDataSource.destroy()
    process.exit(1)
  }

  console.log(`✅ Embedding generated! Dimensions: ${embedding.length}`)
  console.log(`   First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]\n`)

  // Update database
  console.log('💾 Updating database...')
  const embeddingStr = `[${embedding.join(',')}]`
  await AppDataSource.query(
    `UPDATE content_assets SET embedding = $1::vector WHERE id = $2`,
    [embeddingStr, asset.id]
  )

  // Verify update
  const updated = await AppDataSource.query(
    `SELECT
      id,
      name,
      CASE WHEN embedding IS NULL THEN 'NO' ELSE 'YES' END as has_embedding,
      array_length(embedding::float[], 1) as embedding_dimensions
    FROM content_assets
    WHERE id = $1`,
    [asset.id]
  )

  console.log('✅ Database updated successfully!')
  console.log(`   Has embedding: ${updated[0].has_embedding}`)
  console.log(`   Dimensions: ${updated[0].embedding_dimensions}\n`)

  console.log('✅ Test successful! Ready to process all 186 assets.\n')

  await AppDataSource.destroy()
}

testSingleEmbedding().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
