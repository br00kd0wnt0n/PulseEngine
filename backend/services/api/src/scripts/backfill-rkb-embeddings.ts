import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'
import { generateEmbedding } from '../services/embeddings.js'

/**
 * Backfill embeddings for RKB assets that don't have them
 * This script processes all RKB content_assets (projectId IS NULL)
 * and generates embeddings based on filename
 */

async function backfillRKBEmbeddings() {
  console.log('=== RKB EMBEDDING BACKFILL ===\n')

  // Initialize database connection
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize()
  }

  // Find all RKB assets without embeddings
  const assets = await AppDataSource.query(`
    SELECT id, name, metadata
    FROM content_assets
    WHERE "projectId" IS NULL
      AND embedding IS NULL
    ORDER BY "createdAt" ASC
  `)

  console.log(`Found ${assets.length} RKB assets without embeddings\n`)

  if (assets.length === 0) {
    console.log('✅ All RKB assets already have embeddings!')
    process.exit(0)
  }

  let successCount = 0
  let failedCount = 0
  const failed: string[] = []

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    process.stdout.write(`[${i + 1}/${assets.length}] ${asset.name.substring(0, 50).padEnd(50)} ... `)

    try {
      // Generate embedding from filename (best we can do without re-parsing PDFs)
      // Extract useful info from filename pattern: "2025-11-14T12-27-15_COMPANY_Topic.pdf"
      const parts = asset.name.split('_')
      const company = parts[1] || ''
      const topic = parts.slice(2).join(' ').replace('.pdf', '').replace('.jpg', '')

      const embeddingText = `${topic} ${company} industry trends report analysis`

      const embedding = await generateEmbedding(embeddingText)

      if (embedding) {
        const embeddingStr = `[${embedding.join(',')}]`
        await AppDataSource.query(
          `UPDATE content_assets SET embedding = $1::vector WHERE id = $2`,
          [embeddingStr, asset.id]
        )
        console.log('✅')
        successCount++
      } else {
        console.log('❌ No embedding generated')
        failedCount++
        failed.push(asset.name)
      }

      // Rate limit: 100ms between requests to avoid OpenAI rate limits
      if (i < assets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

    } catch (error: any) {
      console.log(`❌ ${error.message}`)
      failedCount++
      failed.push(asset.name)
    }
  }

  // Summary
  console.log('\n===============================================')
  console.log('EMBEDDING BACKFILL COMPLETE')
  console.log('===============================================')
  console.log(`Total: ${assets.length}`)
  console.log(`✅ Success: ${successCount}`)
  console.log(`❌ Failed: ${failedCount}`)
  console.log('===============================================\n')

  if (failedCount > 0) {
    console.log('Failed assets:')
    failed.forEach(name => console.log(`  - ${name}`))
    console.log()
  }

  // Verify final count
  const withEmbeddings = await AppDataSource.query(`
    SELECT COUNT(*) as count
    FROM content_assets
    WHERE "projectId" IS NULL
      AND embedding IS NOT NULL
  `)

  console.log(`\n📊 RKB assets with embeddings: ${withEmbeddings[0].count}/186\n`)

  await AppDataSource.destroy()
}

backfillRKBEmbeddings().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
