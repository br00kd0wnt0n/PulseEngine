import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'

async function checkRKB() {
  console.log('Connecting to database...\n')
  await AppDataSource.initialize()

  console.log('=== RKB STATUS ===\n')

  // Total RKB assets
  const total = await AppDataSource.query(
    `SELECT COUNT(*) as count FROM content_assets WHERE "projectId" IS NULL`
  )
  console.log(`📊 Total RKB assets: ${total[0].count}`)

  // With embeddings
  const withEmbeddings = await AppDataSource.query(
    `SELECT COUNT(*) as count FROM content_assets WHERE "projectId" IS NULL AND embedding IS NOT NULL`
  )
  console.log(`✅ With embeddings: ${withEmbeddings[0].count}`)

  // Without embeddings
  const withoutEmbeddings = await AppDataSource.query(
    `SELECT COUNT(*) as count FROM content_assets WHERE "projectId" IS NULL AND embedding IS NULL`
  )
  console.log(`❌ Without embeddings: ${withoutEmbeddings[0].count}`)

  const percentageComplete = total[0].count > 0
    ? ((withEmbeddings[0].count / total[0].count) * 100).toFixed(1)
    : 0
  console.log(`\n📈 Embedding coverage: ${percentageComplete}%\n`)

  // Sample files without embeddings
  if (parseInt(withoutEmbeddings[0].count) > 0) {
    console.log('=== SAMPLE FILES WITHOUT EMBEDDINGS ===\n')
    const samples = await AppDataSource.query(
      `SELECT id, name, "createdAt" FROM content_assets
       WHERE "projectId" IS NULL AND embedding IS NULL
       ORDER BY "createdAt" DESC
       LIMIT 10`
    )
    console.table(samples.map((s: any) => ({
      name: s.name,
      created: new Date(s.createdAt).toLocaleString(),
      id: s.id.substring(0, 8) + '...'
    })))

    console.log(`\n(Showing 10 of ${withoutEmbeddings[0].count} files without embeddings)\n`)
  }

  // Sample files WITH embeddings (to verify they look correct)
  if (parseInt(withEmbeddings[0].count) > 0) {
    console.log('=== SAMPLE FILES WITH EMBEDDINGS ===\n')
    const samplesWithEmbed = await AppDataSource.query(
      `SELECT name, "createdAt",
              LEFT(embedding::text, 50) as embedding_sample
       FROM content_assets
       WHERE "projectId" IS NULL AND embedding IS NOT NULL
       ORDER BY "createdAt" DESC
       LIMIT 5`
    )
    console.table(samplesWithEmbed.map((s: any) => ({
      name: s.name,
      created: new Date(s.createdAt).toLocaleString(),
      embedding: s.embedding_sample + '...'
    })))
  }

  await AppDataSource.destroy()
  console.log('\n✓ Done!\n')
}

checkRKB().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
