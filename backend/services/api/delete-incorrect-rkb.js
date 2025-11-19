import pg from 'pg'
const { Client } = pg

const DATABASE_URL = "postgres://postgres:BKj4Jgu2xMn48KOIcQhSK95NXs_4K88s@hopper.proxy.rlwy.net:58763/railway"

async function deleteIncorrectFiles() {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    // Find the incorrectly uploaded files
    const result = await client.query(`
      SELECT id, name, "createdAt"
      FROM content_assets
      WHERE "projectId" IS NULL
        AND (name LIKE '%Care Bears%' OR name LIKE '%RFP%')
      ORDER BY "createdAt" DESC
    `)

    console.log(`Found ${result.rows.length} files to delete:`)
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.name} (${row.id}) - ${row.createdAt}`)
    })

    // Delete them
    if (result.rows.length > 0) {
      const ids = result.rows.map(r => r.id)
      const deleteResult = await client.query(`
        DELETE FROM content_assets
        WHERE id = ANY($1::uuid[])
      `, [ids])

      console.log(`\nDeleted ${deleteResult.rowCount} files successfully!`)
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await client.end()
  }
}

deleteIncorrectFiles()
