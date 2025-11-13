#!/usr/bin/env tsx
/**
 * RKB Seed Script
 * Populates trends and creators tables with test data for RAG system
 */

import 'reflect-metadata'
import { AppDataSource } from '../src/db/data-source.js'
import { Trend } from '../src/db/entities/Trend.js'
import { Creator } from '../src/db/entities/Creator.js'

const OWNER_ID = '087d78e9-4bbe-49f6-8981-1588ce4934a2'

const trendsData = [
  // AI & Music (3)
  {
    label: 'AI Music Loop Generation',
    signals: { platform: 'TikTok', category: 'music', velocity: 85, sentiment: 'positive' },
    metrics: { engagement: 12.5, peakWeek: '2025-W02', longevity: 8 }
  },
  {
    label: 'AI-Powered Remix Challenges',
    signals: { platform: 'Instagram', category: 'music', velocity: 72, sentiment: 'positive' },
    metrics: { engagement: 10.2, peakWeek: '2025-W03', longevity: 6 }
  },
  {
    label: 'Text-to-Music Experiments',
    signals: { platform: 'YouTube', category: 'ai-tools', velocity: 68, sentiment: 'mixed' },
    metrics: { engagement: 8.7, peakWeek: '2024-W52', longevity: 12 }
  },
  // Dance (3)
  {
    label: '7-Second Dance Loops',
    signals: { platform: 'TikTok', category: 'dance', velocity: 92, sentiment: 'positive' },
    metrics: { engagement: 15.8, peakWeek: '2025-W01', longevity: 4 }
  },
  {
    label: 'Tutorial-Style Dance Challenges',
    signals: { platform: 'Instagram', category: 'dance', velocity: 78, sentiment: 'positive' },
    metrics: { engagement: 11.3, peakWeek: '2025-W02', longevity: 6 }
  },
  {
    label: 'Duo Sync Dance Collabs',
    signals: { platform: 'TikTok', category: 'dance', velocity: 85, sentiment: 'positive' },
    metrics: { engagement: 14.2, peakWeek: '2025-W01', longevity: 5 }
  },
  // Gaming (3)
  {
    label: 'Retro Gaming Nostalgia Edits',
    signals: { platform: 'YouTube', category: 'gaming', velocity: 65, sentiment: 'positive' },
    metrics: { engagement: 9.8, peakWeek: '2024-W50', longevity: 10 }
  },
  {
    label: '8-Bit Music Mashups',
    signals: { platform: 'TikTok', category: 'gaming-music', velocity: 70, sentiment: 'positive' },
    metrics: { engagement: 10.5, peakWeek: '2025-W01', longevity: 7 }
  },
  {
    label: 'Speedrun Commentary Clips',
    signals: { platform: 'YouTube Shorts', category: 'gaming', velocity: 58, sentiment: 'neutral' },
    metrics: { engagement: 7.2, peakWeek: '2024-W48', longevity: 14 }
  },
  // Editing & Format (3)
  {
    label: 'Beat-Synced Montages',
    signals: { platform: 'TikTok', category: 'editing', velocity: 88, sentiment: 'positive' },
    metrics: { engagement: 13.7, peakWeek: '2025-W01', longevity: 6 }
  },
  {
    label: 'Tutorial-in-Under-30s',
    signals: { platform: 'Instagram Reels', category: 'educational', velocity: 75, sentiment: 'positive' },
    metrics: { engagement: 11.9, peakWeek: '2025-W02', longevity: 8 }
  },
  {
    label: 'Stitch-First Content Design',
    signals: { platform: 'TikTok', category: 'collaboration', velocity: 82, sentiment: 'positive' },
    metrics: { engagement: 12.8, peakWeek: '2025-W01', longevity: 5 }
  },
  // Fashion (3)
  {
    label: 'Streetwear Thrift Flips',
    signals: { platform: 'Instagram', category: 'fashion', velocity: 70, sentiment: 'positive' },
    metrics: { engagement: 10.1, peakWeek: '2024-W51', longevity: 9 }
  },
  {
    label: 'Y2K Aesthetic Revival',
    signals: { platform: 'TikTok', category: 'fashion', velocity: 77, sentiment: 'positive' },
    metrics: { engagement: 11.5, peakWeek: '2024-W52', longevity: 12 }
  },
  {
    label: 'Outfit Transition Reels',
    signals: { platform: 'Instagram Reels', category: 'fashion', velocity: 85, sentiment: 'positive' },
    metrics: { engagement: 13.2, peakWeek: '2025-W01', longevity: 6 }
  }
]

const creatorsData = [
  // AI/Music (3)
  {
    name: 'LoopMaster AI',
    platform: 'TikTok',
    category: 'music',
    metadata: { followers: 450000, avgEngagement: 8.5, contentStyle: 'tutorial', collaborationOpenness: 'high' }
  },
  {
    name: 'SynthWave Sarah',
    platform: 'YouTube',
    category: 'music',
    metadata: { followers: 280000, avgEngagement: 6.2, contentStyle: 'entertainment', collaborationOpenness: 'medium' }
  },
  {
    name: 'AI Music Daily',
    platform: 'Instagram',
    category: 'ai-tools',
    metadata: { followers: 125000, avgEngagement: 7.8, contentStyle: 'educational', collaborationOpenness: 'high' }
  },
  // Dance (3)
  {
    name: 'QuickStep Tutorials',
    platform: 'TikTok',
    category: 'dance',
    metadata: { followers: 890000, avgEngagement: 12.3, contentStyle: 'tutorial', collaborationOpenness: 'high' }
  },
  {
    name: 'Sync Sisters',
    platform: 'Instagram',
    category: 'dance',
    metadata: { followers: 320000, avgEngagement: 9.7, contentStyle: 'entertainment', collaborationOpenness: 'medium' }
  },
  {
    name: '7SecondDance',
    platform: 'TikTok',
    category: 'dance',
    metadata: { followers: 670000, avgEngagement: 11.2, contentStyle: 'entertainment', collaborationOpenness: 'high' }
  },
  // Gaming (3)
  {
    name: 'RetroGameClips',
    platform: 'YouTube',
    category: 'gaming',
    metadata: { followers: 540000, avgEngagement: 5.8, contentStyle: 'entertainment', collaborationOpenness: 'low' }
  },
  {
    name: '8BitRemixer',
    platform: 'TikTok',
    category: 'gaming-music',
    metadata: { followers: 210000, avgEngagement: 8.1, contentStyle: 'entertainment', collaborationOpenness: 'medium' }
  },
  {
    name: 'Speedrun Shorts',
    platform: 'YouTube Shorts',
    category: 'gaming',
    metadata: { followers: 380000, avgEngagement: 6.5, contentStyle: 'educational', collaborationOpenness: 'low' }
  },
  // Editing/Tutorial (3)
  {
    name: 'EditInSeconds',
    platform: 'Instagram',
    category: 'editing',
    metadata: { followers: 195000, avgEngagement: 9.3, contentStyle: 'tutorial', collaborationOpenness: 'high' }
  },
  {
    name: 'TransitionKing',
    platform: 'TikTok',
    category: 'editing',
    metadata: { followers: 510000, avgEngagement: 10.8, contentStyle: 'tutorial', collaborationOpenness: 'medium' }
  },
  {
    name: 'FastTutorials',
    platform: 'Instagram Reels',
    category: 'educational',
    metadata: { followers: 275000, avgEngagement: 8.9, contentStyle: 'tutorial', collaborationOpenness: 'high' }
  }
]

async function seed() {
  console.log('🌱 Starting RKB seed...')

  try {
    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize()
    }
    console.log('✅ Database connected')

    const trendRepo = AppDataSource.getRepository(Trend)
    const creatorRepo = AppDataSource.getRepository(Creator)

    // Seed trends
    console.log(`\n📊 Seeding ${trendsData.length} trends...`)
    for (const data of trendsData) {
      const trend = trendRepo.create({
        ...data,
        ownerId: OWNER_ID
      })
      await trendRepo.save(trend)
      console.log(`  ✓ ${data.label}`)
    }

    // Seed creators
    console.log(`\n👥 Seeding ${creatorsData.length} creators...`)
    for (const data of creatorsData) {
      const creator = creatorRepo.create({
        ...data,
        ownerId: OWNER_ID
      })
      await creatorRepo.save(creator)
      console.log(`  ✓ ${data.name} (${data.platform})`)
    }

    // Verify counts
    const trendCount = await trendRepo.count({ where: { ownerId: OWNER_ID } })
    const creatorCount = await creatorRepo.count({ where: { ownerId: OWNER_ID } })

    console.log('\n✅ Seed complete!')
    console.log(`   Trends: ${trendCount}`)
    console.log(`   Creators: ${creatorCount}`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  }
}

seed()
