import 'reflect-metadata'
import { DataSource } from 'typeorm'
import * as readline from 'readline'

// Environment variables
const OLD_DATABASE_URL = process.env.OLD_DATABASE_URL
const NEW_DATABASE_URL = process.env.NEW_DATABASE_URL
const DRY_RUN = process.env.DRY_RUN === 'true'

if (!OLD_DATABASE_URL || !NEW_DATABASE_URL) {
  console.error('❌ Missing required environment variables:')
  console.error('   OLD_DATABASE_URL - Your current database')
  console.error('   NEW_DATABASE_URL - Your new pgvector database')
  console.error('\nUsage:')
  console.error('OLD_DATABASE_URL="..." NEW_DATABASE_URL="..." node dist/src/scripts/migrate-to-pgvector.js')
  console.error('\nOptional: DRY_RUN=true to preview without making changes')
  process.exit(1)
}

// Create data sources
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

interface MigrationStats {
  table: string
  rowsFound: number
  rowsCopied: number
  status: 'success' | 'error' | 'skipped'
  error?: string
}

const stats: MigrationStats[] = []

async function checkTableExists(db: DataSource, tableName: string): Promise<boolean> {
  const result = await db.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = $1
    )`,
    [tableName]
  )
  return result[0].exists
}

async function migrateTable(tableName: string, idColumn: string = 'id'): Promise<void> {
  console.log(`\n📦 Migrating table: ${tableName}`)
  console.log('─'.repeat(60))

  try {
    // Check if table exists in old DB
    const existsInOld = await checkTableExists(oldDB, tableName)
    if (!existsInOld) {
      console.log(`⚠️  Table "${tableName}" does not exist in old database, skipping`)
      stats.push({ table: tableName, rowsFound: 0, rowsCopied: 0, status: 'skipped' })
      return
    }

    // Get data from old database
    const rows = await oldDB.query(`SELECT * FROM ${tableName} ORDER BY "${idColumn}"`)
    console.log(`   Found ${rows.length} rows`)

    if (rows.length === 0) {
      console.log(`   ✓ Table is empty, nothing to migrate`)
      stats.push({ table: tableName, rowsFound: 0, rowsCopied: 0, status: 'success' })
      return
    }

    if (DRY_RUN) {
      console.log(`   [DRY RUN] Would copy ${rows.length} rows`)
      console.log(`   Sample row:`, JSON.stringify(rows[0], null, 2).substring(0, 200) + '...')
      stats.push({ table: tableName, rowsFound: rows.length, rowsCopied: 0, status: 'skipped' })
      return
    }

    // Check if table exists in new DB
    const existsInNew = await checkTableExists(newDB, tableName)
    if (!existsInNew) {
      console.log(`   ⚠️  Table "${tableName}" does not exist in new database`)
      console.log(`   💡 You may need to run migrations on the new database first`)
      stats.push({
        table: tableName,
        rowsFound: rows.length,
        rowsCopied: 0,
        status: 'error',
        error: 'Table does not exist in target database'
      })
      return
    }

    // Get column names from first row
    const columns = Object.keys(rows[0])
    const columnList = columns.map(c => `"${c}"`).join(', ')
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')

    // Insert each row
    let copied = 0
    for (const row of rows) {
      const values = columns.map(col => row[col])

      try {
        await newDB.query(
          `INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders})`,
          values
        )
        copied++
        if (copied % 10 === 0) {
          process.stdout.write(`\r   Copied ${copied}/${rows.length} rows...`)
        }
      } catch (err: any) {
        console.error(`\n   ❌ Error inserting row:`, err.message)
        if (err.detail) console.error(`      Detail: ${err.detail}`)
      }
    }

    console.log(`\r   ✅ Copied ${copied}/${rows.length} rows`)
    stats.push({ table: tableName, rowsFound: rows.length, rowsCopied: copied, status: 'success' })

  } catch (err: any) {
    console.error(`   ❌ Error: ${err.message}`)
    stats.push({
      table: tableName,
      rowsFound: 0,
      rowsCopied: 0,
      status: 'error',
      error: err.message
    })
  }
}

async function verifyMigration(): Promise<void> {
  console.log('\n\n🔍 VERIFICATION')
  console.log('═'.repeat(60))

  const tables = ['users', 'projects', 'content_assets', 'trends', 'creators']

  for (const table of tables) {
    try {
      const oldCount = await oldDB.query(`SELECT COUNT(*) as count FROM ${table}`)
      const newCount = await newDB.query(`SELECT COUNT(*) as count FROM ${table}`)

      const oldRows = parseInt(oldCount[0].count)
      const newRows = parseInt(newCount[0].count)

      if (oldRows === newRows) {
        console.log(`✅ ${table}: ${oldRows} rows (matched)`)
      } else {
        console.log(`⚠️  ${table}: OLD=${oldRows}, NEW=${newRows} (MISMATCH!)`)
      }
    } catch (err: any) {
      console.log(`❌ ${table}: Error - ${err.message}`)
    }
  }
}

async function printSummary(): Promise<void> {
  console.log('\n\n📊 MIGRATION SUMMARY')
  console.log('═'.repeat(60))

  console.table(stats.map(s => ({
    Table: s.table,
    Found: s.rowsFound,
    Copied: s.rowsCopied,
    Status: s.status,
    Error: s.error || '-'
  })))

  const totalFound = stats.reduce((sum, s) => sum + s.rowsFound, 0)
  const totalCopied = stats.reduce((sum, s) => sum + s.rowsCopied, 0)
  const errors = stats.filter(s => s.status === 'error').length

  console.log(`\nTotal rows found: ${totalFound}`)
  console.log(`Total rows copied: ${totalCopied}`)
  console.log(`Errors: ${errors}`)

  if (errors === 0 && totalFound === totalCopied) {
    console.log('\n✅ Migration completed successfully!')
  } else if (errors > 0) {
    console.log('\n⚠️  Migration completed with errors')
  } else {
    console.log('\n⚠️  Migration completed but row counts do not match')
  }
}

async function migrate() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║         PulseEngine Database Migration Tool                ║')
  console.log('║         From: Standard Postgres → pgvector Postgres        ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n')
  }

  console.log('Old Database:', OLD_DATABASE_URL!.substring(0, 50) + '...')
  console.log('New Database:', NEW_DATABASE_URL!.substring(0, 50) + '...\n')

  // Connect to databases
  console.log('Connecting to databases...')
  await oldDB.initialize()
  console.log('✓ Connected to old database')
  await newDB.initialize()
  console.log('✓ Connected to new database\n')

  if (!DRY_RUN) {
    // Ask for confirmation
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const answer = await new Promise<string>(resolve => {
      rl.question('⚠️  This will copy all data to the new database. Type "MIGRATE" to continue: ', resolve)
    })

    rl.close()

    if (answer.trim() !== 'MIGRATE') {
      console.log('\n❌ Migration cancelled.\n')
      await oldDB.destroy()
      await newDB.destroy()
      return
    }
    console.log('')
  }

  // Migration order matters due to foreign keys
  await migrateTable('users', 'id')
  await migrateTable('projects', 'id')
  await migrateTable('content_assets', 'id')
  await migrateTable('trends', 'id')
  await migrateTable('creators', 'id')

  // Verify migration
  if (!DRY_RUN) {
    await verifyMigration()
  }

  // Print summary
  await printSummary()

  if (!DRY_RUN) {
    console.log('\n📝 NEXT STEPS:')
    console.log('1. Run pgvector migration on new database:')
    console.log('   DATABASE_URL="<new-url>" node dist/src/scripts/run-migrations.js')
    console.log('\n2. Update your Railway services with new DATABASE_URL')
    console.log('\n3. Test the new database thoroughly')
    console.log('\n4. Once verified, you can delete the old database\n')
  }

  // Disconnect
  await oldDB.destroy()
  await newDB.destroy()
}

migrate().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
