import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'

async function fixTable() {
  try {
    await AppDataSource.initialize()
    console.log('[FIX] Database connected\n')

    // Drop existing table with wrong schema
    console.log('[FIX] Dropping old platform_metrics table...')
    await AppDataSource.query('DROP TABLE IF EXISTS platform_metrics CASCADE')

    // Create table with correct schema
    console.log('[FIX] Creating platform_metrics table with correct schema...')
    await AppDataSource.query(`
      CREATE TABLE platform_metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        platform VARCHAR(50) NOT NULL,
        metric_type VARCHAR(100) NOT NULL,
        engagement INTEGER DEFAULT 0,
        velocity DECIMAL(10,2) DEFAULT 0,
        value JSONB NOT NULL DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    // Create indexes
    console.log('[FIX] Creating indexes...')
    await AppDataSource.query(`
      CREATE INDEX idx_platform_metrics_created
      ON platform_metrics("createdAt")
    `)
    await AppDataSource.query(`
      CREATE INDEX idx_platform_metrics_platform
      ON platform_metrics(platform)
    `)
    await AppDataSource.query(`
      CREATE INDEX idx_platform_metrics_type
      ON platform_metrics(metric_type)
    `)

    console.log('[FIX] Success! Table recreated with correct schema\n')

    // Verify
    const columns = await AppDataSource.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'platform_metrics'
      ORDER BY ordinal_position;
    `)
    console.log('[FIX] Columns:')
    columns.forEach((col: any) => {
      console.log(`  ✓ ${col.column_name}: ${col.data_type}`)
    })

    await AppDataSource.destroy()
  } catch (error: any) {
    console.error('[FIX] Error:', error)
    process.exit(1)
  }
}

fixTable()
