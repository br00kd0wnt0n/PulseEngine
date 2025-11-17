import { ApifyClient } from 'apify-client'
import { AppDataSource } from '../../db/data-source.js'
import { PlatformMetric } from '../../db/entities/PlatformMetric.js'

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN || ''
})

interface ApifyActorConfig {
  actorId: string
  platform: string
  metricType: string
  input: Record<string, any>
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
    input: {
      searchTerms: ['#viral', '#trending', '#ai', '#tech'],
      maxTweets: 50,
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
    actorId: 'streamers/youtube-scraper',
    platform: 'youtube',
    metricType: 'trending_video',
    input: {
      searchKeywords: ['viral', 'trending', 'popular', 'ai', 'tutorial'],
      maxResults: 50
    },
    extractData: (item: any) => ({
      engagement: (item.views || 0) + (item.likes || 0) + (item.comments || 0),
      velocity: (item.views || 0) / Math.max(1, Math.floor((Date.now() - new Date(item.date).getTime()) / (1000 * 60 * 60))),
      value: {
        videoId: item.id,
        title: item.title,
        channelName: item.channelName,
        views: item.views,
        likes: item.likes,
        comments: item.comments,
        duration: item.duration
      },
      metadata: {
        date: item.date,
        url: item.url
      }
    })
  },

  // 5. Google News Scraper
  {
    actorId: 'lhotanova/google-news-scraper',
    platform: 'news',
    metricType: 'trending_news',
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
async function runActor(config: ApifyActorConfig): Promise<number> {
  console.log(`[APIFY] Running actor: ${config.actorId} for platform: ${config.platform}`)

  try {
    // Run the actor
    const run = await client.actor(config.actorId).call(config.input, {
      timeout: 300 // 5 minutes max
    })

    // Get results from dataset
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
    return saved
  } catch (error) {
    console.error(`[APIFY] Error running ${config.actorId}:`, error)
    return 0
  }
}

/**
 * Run all configured Apify actors
 */
export async function collectAllMetrics(): Promise<{ total: number; byPlatform: Record<string, number> }> {
  console.log('[APIFY] Starting collection from all actors...')

  const results: Record<string, number> = {}
  let total = 0

  for (const config of ACTORS) {
    const saved = await runActor(config)
    results[config.platform] = (results[config.platform] || 0) + saved
    total += saved
  }

  console.log('[APIFY] Collection complete:', { total, byPlatform: results })
  return { total, byPlatform: results }
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
