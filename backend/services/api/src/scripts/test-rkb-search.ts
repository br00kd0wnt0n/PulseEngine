import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'
import { generateEmbedding } from '../services/embeddings.js'

/**
 * Test RKB semantic search with embeddings
 * Verifies that the 186 industry trend reports are searchable by meaning
 */

async function testRKBSearch() {
  console.log('=== RKB SEMANTIC SEARCH TEST ===\n')

  // Initialize database connection
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize()
  }

  // Verify RKB embeddings count
  const embeddingStats = await AppDataSource.query(`
    SELECT
      COUNT(*) as total,
      COUNT(embedding) as with_embeddings,
      COUNT(*) FILTER (WHERE embedding IS NULL) as without_embeddings
    FROM content_assets
    WHERE "projectId" IS NULL
  `)

  console.log('📊 RKB Embedding Stats:')
  console.log(`   Total RKB assets: ${embeddingStats[0].total}`)
  console.log(`   With embeddings: ${embeddingStats[0].with_embeddings}`)
  console.log(`   Without embeddings: ${embeddingStats[0].without_embeddings}\n`)

  if (embeddingStats[0].with_embeddings === 0) {
    console.log('❌ No embeddings found! Run backfill-rkb-embeddings.ts first.')
    await AppDataSource.destroy()
    process.exit(1)
  }

  // Test queries
  const testQueries = [
    'artificial intelligence trends in technology',
    'fashion and retail industry insights',
    'healthcare innovations',
    'financial services and banking',
    'entertainment and media content',
    'automotive industry developments'
  ]

  for (const query of testQueries) {
    console.log(`\n🔍 Testing query: "${query}"`)
    console.log('─'.repeat(60))

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query)
    if (!queryEmbedding) {
      console.log('❌ Failed to generate query embedding')
      continue
    }

    const embeddingStr = `[${queryEmbedding.join(',')}]`

    // Semantic search using pgvector cosine similarity
    const results = await AppDataSource.query(`
      SELECT
        id,
        name,
        metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM content_assets
      WHERE embedding IS NOT NULL
        AND "projectId" IS NULL
      ORDER BY embedding <=> $1::vector
      LIMIT 5
    `, [embeddingStr])

    if (results.length === 0) {
      console.log('   ⚠️  No results found')
      continue
    }

    console.log(`   Found ${results.length} results:\n`)
    results.forEach((r: any, i: number) => {
      // Extract company and topic from filename
      const parts = r.name.split('_')
      const company = parts[1] || 'Unknown'
      const topic = parts.slice(2).join(' ').replace('.pdf', '').replace('.jpg', '').replace('.jpeg', '').replace('.png', '')

      console.log(`   ${i + 1}. ${company} - ${topic}`)
      console.log(`      Similarity: ${(r.similarity * 100).toFixed(1)}%`)
      console.log(`      File: ${r.name}`)
      if (r.metadata) {
        console.log(`      Metadata: ${JSON.stringify(r.metadata)}`)
      }
      console.log()
    })

    // Wait 200ms between queries to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  // Distribution analysis
  console.log('\n' + '='.repeat(60))
  console.log('📈 EMBEDDING QUALITY ANALYSIS')
  console.log('='.repeat(60))

  // Check for duplicate embeddings (shouldn't be any)
  const duplicates = await AppDataSource.query(`
    SELECT embedding, COUNT(*) as count
    FROM content_assets
    WHERE embedding IS NOT NULL AND "projectId" IS NULL
    GROUP BY embedding
    HAVING COUNT(*) > 1
  `)

  console.log(`\n🔍 Duplicate embeddings: ${duplicates.length}`)
  if (duplicates.length > 0) {
    console.log('   ⚠️  Found duplicate embeddings (might indicate processing issues):')
    duplicates.forEach((d: any) => {
      console.log(`   - ${d.count} files share the same embedding`)
    })
  }

  // Sample embedding dimensions
  const sample = await AppDataSource.query(`
    SELECT
      name,
      array_length(embedding::float[], 1) as dimensions
    FROM content_assets
    WHERE embedding IS NOT NULL AND "projectId" IS NULL
    LIMIT 5
  `)

  console.log(`\n📏 Embedding dimensions (sample of 5):`)
  sample.forEach((s: any) => {
    console.log(`   ${s.name.substring(0, 50).padEnd(50)} → ${s.dimensions}D`)
  })

  // Company distribution
  const companies = await AppDataSource.query(`
    SELECT
      SPLIT_PART(name, '_', 2) as company,
      COUNT(*) as count
    FROM content_assets
    WHERE "projectId" IS NULL AND embedding IS NOT NULL
    GROUP BY SPLIT_PART(name, '_', 2)
    ORDER BY count DESC
    LIMIT 10
  `)

  console.log(`\n🏢 Top 10 companies by RKB asset count:`)
  companies.forEach((c: any, i: number) => {
    console.log(`   ${(i + 1).toString().padStart(2)}. ${c.company.padEnd(30)} ${c.count} files`)
  })

  console.log('\n' + '='.repeat(60))
  console.log('✅ RKB Semantic Search Test Complete!')
  console.log('='.repeat(60) + '\n')

  await AppDataSource.destroy()
}

testRKBSearch().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
