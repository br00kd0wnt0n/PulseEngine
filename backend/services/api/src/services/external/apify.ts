import { ApifyClient } from 'apify-client'
import { AppDataSource } from '../../db/data-source.js'
import { PlatformMetric } from '../../db/entities/PlatformMetric.js'
import { collectionStatus } from './collection-status.js'

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN || ''
})

interface ApifyActorConfig {
  actorId: string
  platform: string
  metricType: string
  input: Record<string, any>
  maxItems: number // Global limit enforced by APIFY client
  extractData: (item: any) => { engagement: number; velocity: number; value: Record<string, any>; metadata: Record<string, any> }
}

/**
 * Configuration for all 7 Apify actors
 */
const ACTORS: ApifyActorConfig[] = [
  // 1. TikTok Hashtag Scraper
  {
    actorId: 'clockworks/tiktok-hashtag-scraper',
    platform: 'tiktok',
    metricType: 'trending_hashtag',
    maxItems: 100, // Global cap enforced by APIFY client
    input: {
      hashtags: ['viral', 'fyp', 'trending', 'dance', 'ai', 'fashion'],
      resultsPerHashtag: 20,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false
    },
    extractData: (item: any) => ({
      engagement: (item.stats?.playCount || 0) + (item.stats?.shareCount || 0) + (item.stats?.commentCount || 0),
      velocity: (item.stats?.shareCount || 0) / Math.max(1, Math.floor((Date.now() - new Date(item.createTime).getTime()) / (1000 * 60 * 60))),
      value: {
        hashtag: item.hashtag,
        videoId: item.id,
        authorName: item.author?.uniqueId,
        description: item.text,
        sounds: item.music,
        stats: item.stats
      },
      metadata: {
        createTime: item.createTime,
        videoUrl: item.webVideoUrl
      }
    })
  },

  // 2. Instagram Hashtag Scraper
  {
    actorId: 'apify/instagram-hashtag-scraper',
    platform: 'instagram',
    metricType: 'trending_hashtag',
    maxItems: 100, // Global cap enforced by APIFY client
    input: {
      hashtags: ['viral', 'trending', 'reels', 'fashion', 'ai'],
      resultsLimit: 50
    },
    extractData: (item: any) => ({
      engagement: (item.likesCount || 0) + (item.commentsCount || 0),
      velocity: (item.likesCount || 0) / Math.max(1, Math.floor((Date.now() - new Date(item.timestamp).getTime()) / (1000 * 60 * 60))),
      value: {
        hashtag: item.hashtag,
        postId: item.id,
        ownerUsername: item.ownerUsername,
        caption: item.caption,
        type: item.type,
        likesCount: item.likesCount,
        commentsCount: item.commentsCount
      },
      metadata: {
        timestamp: item.timestamp,
        url: item.url
      }
    })
  },

  // 3. Tweet Scraper - DISABLED: actor ignores maxTweets parameter
  /* {
    actorId: 'apidojo/tweet-scraper',
    platform: 'twitter',
    metricType: 'trending_tweet',
    maxItems: 100, // Global cap enforced by APIFY client - prevents runaway scraping
    input: {
      searchTerms: ['#viral', '#trending', '#ai', '#tech'],
      maxTweets: 25, // Reduced from 50 - applies per search term
      includeReplies: false
    },
    extractData: (item: any) => ({
      engagement: (item.likes || 0) + (item.retweets || 0) + (item.replies || 0),
      velocity: (item.retweets || 0) / Math.max(1, Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60))),
      value: {
        tweetId: item.id_str,
        text: item.full_text,
        username: item.user?.screen_name,
        hashtags: item.entities?.hashtags,
        likes: item.likes,
        retweets: item.retweets,
        replies: item.replies
      },
      metadata: {
        created_at: item.created_at,
        url: item.url
      }
    })
  }, */

  // 4. YouTube Scraper - DISABLED: permissions issues
  /* {
    actorId: 'streamers/youtube-scraper',
    platform: 'youtube',
    metricType: 'trending_video',
    maxItems: 100, // Global cap enforced by APIFY client
    input: {
      searchQueries: ['viral', 'trending', 'popular', 'ai'],
      maxResults: 25,
      maxResultsShorts: 0,
      maxResultStreams: 0
    },
    extractData: (item: any) => ({
      engagement: (item.viewCount || 0) + (item.likes || 0),
      velocity: (item.viewCount || 0) / Math.max(1, Math.floor((Date.now() - new Date(item.uploadDate || Date.now()).getTime()) / (1000 * 60 * 60))),
      value: {
        videoId: item.id,
        title: item.title,
        channelName: item.channelTitle || item.channelName,
        views: item.viewCount,
        likes: item.likes,
        description: item.description?.substring(0, 200),
        duration: item.duration
      },
      metadata: {
        uploadDate: item.uploadDate,
        url: item.url || `https://www.youtube.com/watch?v=${item.id}`
      }
    })
  }, */

  // 5. Google News Scraper
  {
    actorId: 'lhotanova/google-news-scraper',
    platform: 'news',
    metricType: 'trending_news',
    maxItems: 50, // Global cap enforced by APIFY client
    input: {
      query: 'viral trends OR social media trends OR trending',
      topics: [],
      language: 'US:en',
      maxItems: 50,
      fetchArticleDetails: true,
      proxyConfiguration: {
        useApifyProxy: true
      }
    },
    extractData: (item: any) => ({
      engagement: 0, // News doesn't have direct engagement
      velocity: 0,
      value: {
        title: item.title,
        source: item.source,
        description: item.description,
        link: item.link
      },
      metadata: {
        publishedDate: item.publishedDate,
        category: item.category
      }
    })
  },

  // 6. Wikipedia Scraper - DISABLED: Wikipedia blocking scraper (404 errors)
  /* {
    actorId: 'jupri/wiki-scraper',
    platform: 'wiki',
    metricType: 'trending_topic',
    maxItems: 50, // Global cap enforced by APIFY client
    input: {
      pages: [
        'https://en.wikipedia.org/wiki/List_of_Internet_phenomena',
        'https://en.wikipedia.org/wiki/Viral_phenomenon',
        'https://en.wikipedia.org/wiki/Internet_meme'
      ],
      content: 'markdown'
    },
    extractData: (item: any) => ({
      engagement: 0,
      velocity: 0,
      value: {
        title: item.title,
        content: item.content?.substring(0, 500),
        categories: item.categories
      },
      metadata: {
        url: item.url,
        lastModified: item.lastModified
      }
    })
  }, */

  // 7. Fandom Scraper - Entertainment trending topics
  {
    actorId: 'kuaima/Fandom',
    platform: 'fandom',
    metricType: 'trending_fandom',
    maxItems: 50, // Global cap enforced by APIFY client
    input: {
      startUrls: [
        { url: 'https://www.fandom.com/topics/movies' },
        { url: 'https://www.fandom.com/topics/games' },
        { url: 'https://www.fandom.com/topics/tv' }
      ],
      download_image: false
    },
    extractData: (item: any) => ({
      engagement: item.views || 0,
      velocity: 0,
      value: {
        title: item.title,
        wiki: item.wiki,
        content: item.content?.substring(0, 500),
        views: item.views
      },
      metadata: {
        url: item.url,
        categories: item.categories
      }
    })
  }
]

/**
 * Run a single Apify actor and store results
 */
async function runActor(config: ApifyActorConfig, reportProgress: boolean = false): Promise<number> {
  console.log(`\n========================================`)
  console.log(`[APIFY] Starting actor: ${config.actorId}`)
  console.log(`[APIFY] Platform: ${config.platform}`)
  console.log(`[APIFY] Max items: ${config.maxItems}`)
  console.log(`[APIFY] Input:`, JSON.stringify(config.input, null, 2))
  console.log(`========================================\n`)

  if (reportProgress) {
    collectionStatus.updateActor(config.actorId, {
      status: 'running',
      startedAt: new Date()
    })
  }

  try {
    // Run the actor
    console.log(`[APIFY] Calling actor ${config.actorId}...`)
    const run = await client.actor(config.actorId).call(config.input, {
      timeout: 300 // 5 minutes max
    })
    console.log(`[APIFY] Actor run completed. Run ID: ${run.id}, Status: ${run.status}`)

    // Get results from dataset with explicit limit
    console.log(`[APIFY] Fetching results from dataset ${run.defaultDatasetId} with limit ${config.maxItems}...`)
    const { items } = await client.dataset(run.defaultDatasetId).listItems({
      limit: config.maxItems
    })

    console.log(`[APIFY] ✓ ${config.actorId} returned ${items.length} items (limit: ${config.maxItems})`)

    // Store each item in platform_metrics
    const repo = AppDataSource.getRepository(PlatformMetric)
    let saved = 0

    for (const item of items) {
      try {
        const extracted = config.extractData(item)

        const metric = repo.create({
          platform: config.platform,
          metric_type: config.metricType,
          engagement: extracted.engagement,
          velocity: extracted.velocity,
          value: extracted.value,
          metadata: extracted.metadata
        })

        await repo.save(metric)
        saved++
      } catch (err) {
        console.error(`[APIFY] Failed to save item from ${config.actorId}:`, err)
      }
    }

    console.log(`[APIFY] ✓ Saved ${saved}/${items.length} items for ${config.platform}\n`)

    if (reportProgress) {
      collectionStatus.updateActor(config.actorId, {
        status: 'completed',
        itemsSaved: saved,
        completedAt: new Date()
      })
    }

    return saved
  } catch (error: any) {
    console.error(`\n❌ [APIFY] ACTOR FAILED: ${config.actorId}`)
    console.error(`[APIFY] Error type: ${error?.constructor?.name}`)
    console.error(`[APIFY] Error message: ${error?.message}`)
    console.error(`[APIFY] Error code: ${error?.code}`)
    console.error(`[APIFY] Full error:`, error)
    console.error(`========================================\n`)

    if (reportProgress) {
      collectionStatus.updateActor(config.actorId, {
        status: 'failed',
        error: error?.message || String(error),
        completedAt: new Date()
      })
    }

    return 0
  }
}

/**
 * Run all configured Apify actors (SYNCHRONOUS - blocks until complete)
 * Use this for cron jobs where you want to wait for completion
 */
export async function collectAllMetrics(): Promise<{ total: number; byPlatform: Record<string, number> }> {
  console.log('[APIFY] Starting collection from all actors...')

  const results: Record<string, number> = {}
  let total = 0

  for (const config of ACTORS) {
    const saved = await runActor(config, false)
    results[config.platform] = (results[config.platform] || 0) + saved
    total += saved
  }

  console.log('[APIFY] Collection complete:', { total, byPlatform: results })
  return { total, byPlatform: results }
}

/**
 * Run all configured Apify actors ASYNC (fire-and-forget with progress tracking)
 * Returns immediately with jobId, collection runs in background
 */
export function collectAllMetricsAsync(): string {
  // Start a new job
  const jobId = collectionStatus.startJob(
    ACTORS.map(a => ({ actorId: a.actorId, platform: a.platform }))
  )

  console.log(`\n╔════════════════════════════════════════════════════════════╗`)
  console.log(`║  APIFY COLLECTION JOB STARTED                              ║`)
  console.log(`╚════════════════════════════════════════════════════════════╝`)
  console.log(`Job ID: ${jobId}`)
  console.log(`Total actors: ${ACTORS.length}`)
  console.log(`Actors to run:`)
  ACTORS.forEach((a, i) => {
    console.log(`  ${i + 1}. ${a.platform.toUpperCase()} (${a.actorId})`)
  })
  console.log(`\n`)

  // Run collection in background (don't await)
  ;(async () => {
    try {
      for (let i = 0; i < ACTORS.length; i++) {
        const config = ACTORS[i]
        console.log(`\n[APIFY] ►►► Processing actor ${i + 1}/${ACTORS.length}: ${config.platform} ◄◄◄`)
        try {
          await runActor(config, true) // reportProgress = true
          console.log(`[APIFY] ✓ Actor ${i + 1}/${ACTORS.length} completed: ${config.platform}`)
        } catch (actorError: any) {
          console.error(`\n[APIFY] ❌ Actor ${i + 1}/${ACTORS.length} FAILED: ${config.platform}`)
          console.error(`[APIFY] Error: ${actorError?.message || String(actorError)}`)
          console.error(`[APIFY] Continuing to next actor...\n`)
          // Don't break the loop - continue to next actor
        }
      }
      collectionStatus.completeJob()
      console.log(`\n╔════════════════════════════════════════════════════════════╗`)
      console.log(`║  APIFY COLLECTION JOB COMPLETED                            ║`)
      console.log(`╚════════════════════════════════════════════════════════════╝`)
      console.log(`Job ID: ${jobId}`)
      console.log(`Status: SUCCESS\n`)
    } catch (error: any) {
      collectionStatus.failJob(error?.message || String(error))
      console.error(`\n╔════════════════════════════════════════════════════════════╗`)
      console.error(`║  APIFY COLLECTION JOB FAILED                               ║`)
      console.error(`╚════════════════════════════════════════════════════════════╝`)
      console.error(`Job ID: ${jobId}`)
      console.error(`Error: ${error?.message || String(error)}\n`)
    }
  })()

  return jobId
}

/**
 * Get current collection status
 */
export function getCollectionStatus() {
  return collectionStatus.getStatus()
}

/**
 * Cleanup old metrics (keep last N days)
 */
export async function cleanupOldMetrics(daysToKeep: number = 30): Promise<number> {
  console.log(`[APIFY] Cleaning up metrics older than ${daysToKeep} days...`)

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysToKeep)

  const result = await AppDataSource.query(
    `DELETE FROM platform_metrics WHERE "createdAt" < $1`,
    [cutoff]
  )

  const deletedCount = result[1] || 0
  console.log(`[APIFY] Deleted ${deletedCount} old metrics`)

  return deletedCount
}

/**
 * Get metrics summary (for dashboard)
 */
export async function getMetricsSummary(): Promise<{
  total: number
  byPlatform: Record<string, number>
  lastUpdate: Date | null
}> {
  const repo = AppDataSource.getRepository(PlatformMetric)

  const total = await repo.count()

  const byPlatform: Record<string, number> = {}
  const platforms = await repo
    .createQueryBuilder('metric')
    .select('metric.platform, COUNT(*) as count')
    .groupBy('metric.platform')
    .getRawMany()

  platforms.forEach(p => {
    byPlatform[p.platform] = parseInt(p.count)
  })

  const latest = await repo
    .createQueryBuilder('metric')
    .orderBy('metric.createdAt', 'DESC')
    .limit(1)
    .getOne()

  return {
    total,
    byPlatform,
    lastUpdate: latest?.createdAt || null
  }
}
