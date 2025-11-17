import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'
import * as readline from 'readline'

async function clearRKBNoEmbeddings() {
  console.log('Connecting to database...\n')
  await AppDataSource.initialize()

  // Count before deletion
  const countBefore = await AppDataSource.query(
    `SELECT COUNT(*) as count FROM content_assets WHERE "projectId" IS NULL AND embedding IS NULL`
  )

  const toDelete = parseInt(countBefore[0].count)

  if (toDelete === 0) {
    console.log('✓ No RKB assets without embeddings found. Nothing to delete!\n')
    await AppDataSource.destroy()
    return
  }

  console.log(`⚠️  ABOUT TO DELETE ${toDelete} RKB assets WITHOUT embeddings\n`)

  // Show sample of what will be deleted
  console.log('Sample of files to be deleted:\n')
  const samples = await AppDataSource.query(
    `SELECT name, "createdAt" FROM content_assets
     WHERE "projectId" IS NULL AND embedding IS NULL
     ORDER BY "createdAt" DESC
     LIMIT 10`
  )
  console.table(samples.map((s: any) => ({
    name: s.name,
    created: new Date(s.createdAt).toLocaleString()
  })))

  if (toDelete > 10) {
    console.log(`\n(Showing 10 of ${toDelete} files)\n`)
  }

  // Ask for confirmation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const answer = await new Promise<string>(resolve => {
    rl.question('\nType "DELETE" to confirm deletion: ', resolve)
  })

  rl.close()

  if (answer.trim() !== 'DELETE') {
    console.log('\n❌ Deletion cancelled.\n')
    await AppDataSource.destroy()
    return
  }

  console.log('\nDeleting...')

  // Delete RKB assets without embeddings
  const result = await AppDataSource.query(
    `DELETE FROM content_assets WHERE "projectId" IS NULL AND embedding IS NULL`
  )

  const deletedCount = result[1] || toDelete

  console.log(`\n✅ Deleted ${deletedCount} RKB assets without embeddings`)
  console.log('✓ RKB assets WITH embeddings were preserved')
  console.log('✓ Project-specific assets were NOT affected\n')

  // Verify
  const remaining = await AppDataSource.query(
    `SELECT COUNT(*) as count FROM content_assets WHERE "projectId" IS NULL`
  )
  console.log(`📊 Remaining RKB assets: ${remaining[0].count}\n`)

  await AppDataSource.destroy()
}

clearRKBNoEmbeddings().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
