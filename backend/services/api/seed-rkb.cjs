#!/usr/bin/env node
/**
 * Simple JavaScript seed script that uses curl to populate RKB via API
 */

const API_URL = 'https://api-production-768d.up.railway.app'
const { execSync } = require('child_process')

// First, we need to login to get a token
console.log('🔐 This seed script requires authentication.')
console.log('📝 You need to provide login credentials to seed the database.\n')

// For now, let's seed via curl with the existing user
// Since we can't login easily, let's use the SQL approach with pg client

const { Client } = require('pg')

const trendsData = [
  { label: 'AI Music Loop Generation', signals: { platform: 'TikTok', category: 'music', velocity: 85, sentiment: 'positive' }, metrics: { engagement: 12.5, peakWeek: '2025-W02', longevity: 8 } },
  { label: 'AI-Powered Remix Challenges', signals: { platform: 'Instagram', category: 'music', velocity: 72, sentiment: 'positive' }, metrics: { engagement: 10.2, peakWeek: '2025-W03', longevity: 6 } },
  { label: 'Text-to-Music Experiments', signals: { platform: 'YouTube', category: 'ai-tools', velocity: 68, sentiment: 'mixed' }, metrics: { engagement: 8.7, peakWeek: '2024-W52', longevity: 12 } },
  { label: '7-Second Dance Loops', signals: { platform: 'TikTok', category: 'dance', velocity: 92, sentiment: 'positive' }, metrics: { engagement: 15.8, peakWeek: '2025-W01', longevity: 4 } },
  { label: 'Tutorial-Style Dance Challenges', signals: { platform: 'Instagram', category: 'dance', velocity: 78, sentiment: 'positive' }, metrics: { engagement: 11.3, peakWeek: '2025-W02', longevity: 6 } },
  { label: 'Duo Sync Dance Collabs', signals: { platform: 'TikTok', category: 'dance', velocity: 85, sentiment: 'positive' }, metrics: { engagement: 14.2, peakWeek: '2025-W01', longevity: 5 } },
  { label: 'Retro Gaming Nostalgia Edits', signals: { platform: 'YouTube', category: 'gaming', velocity: 65, sentiment: 'positive' }, metrics: { engagement: 9.8, peakWeek: '2024-W50', longevity: 10 } },
  { label: '8-Bit Music Mashups', signals: { platform: 'TikTok', category: 'gaming-music', velocity: 70, sentiment: 'positive' }, metrics: { engagement: 10.5, peakWeek: '2025-W01', longevity: 7 } },
  { label: 'Speedrun Commentary Clips', signals: { platform: 'YouTube Shorts', category: 'gaming', velocity: 58, sentiment: 'neutral' }, metrics: { engagement: 7.2, peakWeek: '2024-W48', longevity: 14 } },
  { label: 'Beat-Synced Montages', signals: { platform: 'TikTok', category: 'editing', velocity: 88, sentiment: 'positive' }, metrics: { engagement: 13.7, peakWeek: '2025-W01', longevity: 6 } },
  { label: 'Tutorial-in-Under-30s', signals: { platform: 'Instagram Reels', category: 'educational', velocity: 75, sentiment: 'positive' }, metrics: { engagement: 11.9, peakWeek: '2025-W02', longevity: 8 } },
  { label: 'Stitch-First Content Design', signals: { platform: 'TikTok', category: 'collaboration', velocity: 82, sentiment: 'positive' }, metrics: { engagement: 12.8, peakWeek: '2025-W01', longevity: 5 } },
  { label: 'Streetwear Thrift Flips', signals: { platform: 'Instagram', category: 'fashion', velocity: 70, sentiment: 'positive' }, metrics: { engagement: 10.1, peakWeek: '2024-W51', longevity: 9 } },
  { label: 'Y2K Aesthetic Revival', signals: { platform: 'TikTok', category: 'fashion', velocity: 77, sentiment: 'positive' }, metrics: { engagement: 11.5, peakWeek: '2024-W52', longevity: 12 } },
  { label: 'Outfit Transition Reels', signals: { platform: 'Instagram Reels', category: 'fashion', velocity: 85, sentiment: 'positive' }, metrics: { engagement: 13.2, peakWeek: '2025-W01', longevity: 6 } },
]

const creatorsData = [
  { name: 'LoopMaster AI', platform: 'TikTok', category: 'music', metadata: { followers: 450000, avgEngagement: 8.5, contentStyle: 'tutorial', collaborationOpenness: 'high' } },
  { name: 'SynthWave Sarah', platform: 'YouTube', category: 'music', metadata: { followers: 280000, avgEngagement: 6.2, contentStyle: 'entertainment', collaborationOpenness: 'medium' } },
  { name: 'AI Music Daily', platform: 'Instagram', category: 'ai-tools', metadata: { followers: 125000, avgEngagement: 7.8, contentStyle: 'educational', collaborationOpenness: 'high' } },
  { name: 'QuickStep Tutorials', platform: 'TikTok', category: 'dance', metadata: { followers: 890000, avgEngagement: 12.3, contentStyle: 'tutorial', collaborationOpenness: 'high' } },
  { name: 'Sync Sisters', platform: 'Instagram', category: 'dance', metadata: { followers: 320000, avgEngagement: 9.7, contentStyle: 'entertainment', collaborationOpenness: 'medium' } },
  { name: '7SecondDance', platform: 'TikTok', category: 'dance', metadata: { followers: 670000, avgEngagement: 11.2, contentStyle: 'entertainment', collaborationOpenness: 'high' } },
  { name: 'RetroGameClips', platform: 'YouTube', category: 'gaming', metadata: { followers: 540000, avgEngagement: 5.8, contentStyle: 'entertainment', collaborationOpenness: 'low' } },
  { name: '8BitRemixer', platform: 'TikTok', category: 'gaming-music', metadata: { followers: 210000, avgEngagement: 8.1, contentStyle: 'entertainment', collaborationOpenness: 'medium' } },
  { name: 'Speedrun Shorts', platform: 'YouTube Shorts', category: 'gaming', metadata: { followers: 380000, avgEngagement: 6.5, contentStyle: 'educational', collaborationOpenness: 'low' } },
  { name: 'EditInSeconds', platform: 'Instagram', category: 'editing', metadata: { followers: 195000, avgEngagement: 9.3, contentStyle: 'tutorial', collaborationOpenness: 'high' } },
  { name: 'TransitionKing', platform: 'TikTok', category: 'editing', metadata: { followers: 510000, avgEngagement: 10.8, contentStyle: 'tutorial', collaborationOpenness: 'medium' } },
  { name: 'FastTutorials', platform: 'Instagram Reels', category: 'educational', metadata: { followers: 275000, avgEngagement: 8.9, contentStyle: 'tutorial', collaborationOpenness: 'high' } },
]

async function seed() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set')
    process.exit(1)
  }

  const client = new Client({ connectionString: DATABASE_URL })

  try {
    await client.connect()
    console.log('✅ Connected to database')

    const OWNER_ID = '087d78e9-4bbe-49f6-8981-1588ce4934a2'

    // Seed trends
    console.log(`\n📊 Seeding ${trendsData.length} trends...`)
    for (const trend of trendsData) {
      await client.query(
        `INSERT INTO trends (id, label, signals, metrics, "ownerId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())`,
        [trend.label, trend.signals, trend.metrics, OWNER_ID]
      )
      console.log(`  ✓ ${trend.label}`)
    }

    // Seed creators
    console.log(`\n👥 Seeding ${creatorsData.length} creators...`)
    for (const creator of creatorsData) {
      await client.query(
        `INSERT INTO creators (id, name, platform, category, metadata, "ownerId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())`,
        [creator.name, creator.platform, creator.category, creator.metadata, OWNER_ID]
      )
      console.log(`  ✓ ${creator.name} (${creator.platform})`)
    }

    // Verify
    const trendCount = await client.query('SELECT COUNT(*) FROM trends WHERE "ownerId" = $1', [OWNER_ID])
    const creatorCount = await client.query('SELECT COUNT(*) FROM creators WHERE "ownerId" = $1', [OWNER_ID])

    console.log('\n✅ Seed complete!')
    console.log(`   Trends: ${trendCount.rows[0].count}`)
    console.log(`   Creators: ${creatorCount.rows[0].count}`)

    await client.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Seed failed:', error.message)
    await client.end()
    process.exit(1)
  }
}

seed()
