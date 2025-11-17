import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'

async function checkTable() {
  try {
    await AppDataSource.initialize()
    console.log('[CHECK] Database connected\n')

    // Check if table exists
    const tableCheck = await AppDataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'platform_metrics'
      );
    `)

    const tableExists = tableCheck[0].exists
    console.log(`[CHECK] platform_metrics table exists: ${tableExists}\n`)

    if (tableExists) {
      // Get column info
      const columns = await AppDataSource.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'platform_metrics'
        ORDER BY ordinal_position;
      `)
      console.log('[CHECK] Columns:')
      columns.forEach((col: any) => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
      })

      // Get index info
      console.log('\n[CHECK] Indexes:')
      const indexes = await AppDataSource.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'platform_metrics';
      `)
      indexes.forEach((idx: any) => {
        console.log(`  - ${idx.indexname}`)
      })
    }

    await AppDataSource.destroy()
  } catch (error: any) {
    console.error('[CHECK] Error:', error.message)
    process.exit(1)
  }
}

checkTable()
