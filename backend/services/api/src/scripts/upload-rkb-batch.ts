import 'reflect-metadata'
import fs from 'fs'
import path from 'path'
import FormData from 'form-data'
import fetch from 'node-fetch'

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================

const INGESTION_URL = process.env.INGESTION_URL || 'https://ingestion-production-c716.up.railway.app'
const OWNER_ID = process.env.OWNER_ID || 'YOUR_SEED_USER_ID_HERE'  // Get from get-seed-user.ts script
const RKB_FOLDER = process.env.RKB_FOLDER || './rkb-files'  // Folder with your RKB files

// ============================================

interface UploadResult {
  file: string
  success: boolean
  error?: string
}

async function uploadFile(filePath: string): Promise<UploadResult> {
  const fileName = path.basename(filePath)

  try {
    const form = new FormData()
    form.append('files', fs.createReadStream(filePath))
    form.append('ownerId', OWNER_ID)
    // No projectId = RKB upload (defaults to NULL)

    const response = await fetch(`${INGESTION_URL}/ingest/upload`, {
      method: 'POST',
      body: form as any
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        file: fileName,
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      }
    }

    const result = await response.json()
    return {
      file: fileName,
      success: true
    }
  } catch (error) {
    return {
      file: fileName,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function uploadAllFiles() {
  console.log('=== RKB BATCH UPLOAD ===\n')
  console.log(`Ingestion URL: ${INGESTION_URL}`)
  console.log(`Owner ID: ${OWNER_ID}`)
  console.log(`RKB Folder: ${RKB_FOLDER}\n`)

  // Validate configuration
  if (OWNER_ID === 'YOUR_SEED_USER_ID_HERE') {
    console.error('❌ Error: Please set OWNER_ID in the script or environment variable')
    console.error('   Run: npx ts-node-esm src/scripts/get-seed-user.ts to get your user ID\n')
    process.exit(1)
  }

  if (!fs.existsSync(RKB_FOLDER)) {
    console.error(`❌ Error: Folder not found: ${RKB_FOLDER}`)
    console.error(`   Create the folder and add your RKB files, or update RKB_FOLDER in the script\n`)
    process.exit(1)
  }

  // Find all files
  const allFiles = fs.readdirSync(RKB_FOLDER)
  const files = allFiles.filter(f =>
    f.endsWith('.pdf') ||
    f.endsWith('.txt') ||
    f.endsWith('.docx') ||
    f.endsWith('.doc') ||
    f.endsWith('.jpg') ||
    f.endsWith('.jpeg') ||
    f.endsWith('.png')
  )

  if (files.length === 0) {
    console.error(`❌ No files found in ${RKB_FOLDER}`)
    console.error(`   Supported formats: .pdf, .txt, .docx, .doc, .jpg, .jpeg, .png\n`)
    process.exit(1)
  }

  console.log(`📁 Found ${files.length} files to upload\n`)
  console.log('Starting upload...\n')

  const results: UploadResult[] = []
  let successCount = 0
  let failedCount = 0

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const filePath = path.join(RKB_FOLDER, file)

    process.stdout.write(`[${i + 1}/${files.length}] ${file.padEnd(40)} ... `)

    const result = await uploadFile(filePath)
    results.push(result)

    if (result.success) {
      console.log('✅ Success')
      successCount++
    } else {
      console.log(`❌ Failed`)
      if (result.error) {
        console.log(`    Error: ${result.error}`)
      }
      failedCount++
    }

    // Rate limit: wait 1 second between uploads to avoid overwhelming OpenAI API
    if (i < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  // Summary
  console.log('\n===============================================')
  console.log('UPLOAD COMPLETE')
  console.log('===============================================')
  console.log(`Total: ${files.length}`)
  console.log(`✅ Success: ${successCount}`)
  console.log(`❌ Failed: ${failedCount}`)
  console.log('===============================================\n')

  if (failedCount > 0) {
    console.log('Failed files:')
    results
      .filter(r => !r.success)
      .forEach(r => console.log(`  - ${r.file}: ${r.error}`))
    console.log()
  }

  console.log('💡 Next step: Run check-rkb.ts to verify embeddings were generated\n')
}

uploadAllFiles().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
