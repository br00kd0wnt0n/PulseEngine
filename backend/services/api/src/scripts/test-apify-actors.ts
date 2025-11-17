import 'reflect-metadata'
import { ApifyClient } from 'apify-client'

const API_TOKEN = process.env.APIFY_API_TOKEN

if (!API_TOKEN) {
  console.error('❌ APIFY_API_TOKEN not set in environment')
  process.exit(1)
}

const client = new ApifyClient({ token: API_TOKEN })

const ACTORS = [
  { id: 'clockworks/tiktok-hashtag-scraper', platform: 'TikTok' },
  { id: 'apify/instagram-hashtag-scraper', platform: 'Instagram' },
  { id: 'apidojo/tweet-scraper', platform: 'Twitter' },
  { id: 'streamers/youtube-scraper', platform: 'YouTube' },
  { id: 'lhotanova/google-news-scraper', platform: 'Google News' },
  { id: 'jupri/wiki-scraper', platform: 'Wikipedia' },
  { id: 'kuaima/Fandom', platform: 'Fandom' }
]

async function testActor(actorId: string, platform: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Testing: ${platform} (${actorId})`)
  console.log('='.repeat(60))

  try {
    // Check if actor exists
    console.log('1. Checking actor exists...')
    const actor = await client.actor(actorId).get()

    if (actor) {
      console.log(`   ✅ Actor found: ${actor.name}`)
      console.log(`   📝 Description: ${actor.description?.substring(0, 100) || 'N/A'}`)
      console.log(`   👤 Username: ${actor.username}`)
      console.log(`   📊 Stats: ${actor.stats?.totalRuns || 0} total runs`)
    }

    // Try to get last run (if any)
    console.log('2. Checking recent runs...')
    const runs = await client.actor(actorId).runs().list({ limit: 1 })

    if (runs.items.length > 0) {
      const lastRun = runs.items[0]
      console.log(`   ✅ Last run: ${lastRun.status}`)
      console.log(`   ⏱️  Started: ${lastRun.startedAt}`)
      console.log(`   💾 Dataset: ${lastRun.defaultDatasetId}`)
    } else {
      console.log(`   ℹ️  No previous runs found`)
    }

    return { platform, actorId, status: 'accessible', error: null }

  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`)

    if (error.statusCode === 404) {
      console.log(`   💡 Actor not found - may need to be added in APIFY dashboard`)
    } else if (error.statusCode === 401 || error.statusCode === 403) {
      console.log(`   💡 Authentication issue - check APIFY_API_TOKEN`)
    }

    return { platform, actorId, status: 'error', error: error.message }
  }
}

async function testAllActors() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║         APIFY Actor Connectivity Test                      ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  console.log(`API Token: ${API_TOKEN!.substring(0, 20)}...${API_TOKEN!.substring(API_TOKEN!.length - 4)}\n`)

  const results = []

  for (const actor of ACTORS) {
    const result = await testActor(actor.id, actor.platform)
    results.push(result)

    // Wait 500ms between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`)
  console.log('SUMMARY')
  console.log('='.repeat(60))

  const accessible = results.filter(r => r.status === 'accessible')
  const errors = results.filter(r => r.status === 'error')

  console.log(`\n✅ Accessible: ${accessible.length}/7`)
  console.log(`❌ Errors: ${errors.length}/7\n`)

  if (accessible.length > 0) {
    console.log('Accessible actors:')
    accessible.forEach(r => console.log(`  ✓ ${r.platform} (${r.actorId})`))
  }

  if (errors.length > 0) {
    console.log('\nActors with errors:')
    errors.forEach(r => console.log(`  ✗ ${r.platform}: ${r.error}`))
  }

  console.log('\n' + '='.repeat(60))

  if (accessible.length === 7) {
    console.log('✅ ALL ACTORS ACCESSIBLE - Ready to run scrapes!')
  } else {
    console.log(`⚠️  ${errors.length} actor(s) need attention in APIFY dashboard`)
  }

  console.log('='.repeat(60) + '\n')
}

testAllActors().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
