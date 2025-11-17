import 'reflect-metadata'
import { AppDataSource } from '../db/data-source.js'

async function getSeedUser() {
  console.log('Connecting to database...\n')
  await AppDataSource.initialize()

  console.log('=== USERS IN DATABASE ===\n')

  const users = await AppDataSource.query(
    `SELECT id, email, role, "createdAt" FROM users ORDER BY "createdAt" ASC LIMIT 10`
  )

  if (users.length === 0) {
    console.log('❌ No users found in database!\n')
    await AppDataSource.destroy()
    return
  }

  console.table(users.map((u: any) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    created: new Date(u.createdAt).toLocaleString()
  })))

  const seedUser = users.find((u: any) => u.email.includes('seed') || u.role === 'admin') || users[0]

  console.log('\n=== RECOMMENDED USER FOR RKB UPLOADS ===\n')
  console.log(`Email: ${seedUser.email}`)
  console.log(`Role: ${seedUser.role}`)
  console.log(`ID: ${seedUser.id}`)
  console.log('\n💡 Use this ID for the OWNER_ID in your upload script\n')

  // Copy-paste ready
  console.log('Copy this for your upload script:')
  console.log(`OWNER_ID="${seedUser.id}"\n`)

  await AppDataSource.destroy()
}

getSeedUser().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
