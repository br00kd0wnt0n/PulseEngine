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

  // 3. Tweet Scraper
  {
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
  },

  // 4. YouTube Scraper
  {
    actorId: 'bernardo/youtube-scraper',
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
  },

  // 5. Google News Scraper
  {
    actorId: 'lhotanova/google-news-scraper',
    platform: 'news',
    metricType: 'trending_news',
    maxItems: 50, // Global cap enforced by APIFY client
    input: {
      queries: ['viral trends', 'social media trends', 'trending now'],
      maxArticles: 30
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

  // 6. Wikipedia Scraper
  {
    actorId: 'jupri/wiki-scraper',
    platform: 'wiki',
    metricType: 'trending_topic',
    maxItems: 50, // Global cap enforced by APIFY client
    input: {
      articleUrls: ['https://en.wikipedia.org/wiki/List_of_Internet_phenomena'],
      maxDepth: 1
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
  },

  // 7. Fandom Scraper
  {
    actorId: 'kuaima/Fandom',
    platform: 'fandom',
    metricType: 'trending_fandom',
    maxItems: 50, // Global cap enforced by APIFY client
    input: {
      wikis: ['tiktok', 'youtube', 'memes'],
      maxPages: 20
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
  console.log(`[APIFY] Running actor: ${config.actorId} for platform: ${config.platform}`)

  if (reportProgress) {
    collectionStatus.updateActor(config.actorId, {
      status: 'running',
      startedAt: new Date()
    })
  }

  try {
    // Run the actor with maxItems enforced
    const run = await client.actor(config.actorId).call(config.input, {
      timeout: 300, // 5 minutes max
      maxItems: config.maxItems // Hard limit on results returned
    })

    // Get results from dataset (limited by maxItems above)
    const { items } = await client.dataset(run.defaultDatasetId).listItems()

    console.log(`[APIFY] ${config.actorId} returned ${items.length} items`)

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

    console.log(`[APIFY] Saved ${saved}/${items.length} items for ${config.platform}`)

    if (reportProgress) {
      collectionStatus.updateActor(config.actorId, {
        status: 'completed',
        itemsSaved: saved,
        completedAt: new Date()
      })
    }

    return saved
  } catch (error: any) {
    console.error(`[APIFY] Error running ${config.actorId}:`, error)

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

  console.log(`[APIFY] Starting async collection job: ${jobId}`)

  // Run collection in background (don't await)
  ;(async () => {
    try {
      for (const config of ACTORS) {
        await runActor(config, true) // reportProgress = true
      }
      collectionStatus.completeJob()
      console.log(`[APIFY] Job ${jobId} completed successfully`)
    } catch (error: any) {
      collectionStatus.failJob(error?.message || String(error))
      console.error(`[APIFY] Job ${jobId} failed:`, error)
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
