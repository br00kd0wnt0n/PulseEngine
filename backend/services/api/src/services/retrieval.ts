/**
 * Multi-Source RAG Retrieval Service
 *
 * Retrieves context from multiple knowledge sources:
 * 1. Project-Specific Content (user's brief and contextual uploads for current project)
 * 2. Core RKB (Ralph Knowledge Base: trends, creators, industry examples - projectId IS NULL)
 * 3. Live Social Data (Apify, platform APIs)
 * 4. Predictive Trends (Google Trends, forecasts)
 *
 * Architecture:
 * - Core RKB (projectId = NULL): Industry examples, best practices - available to all users
 * - Project Content (projectId = UUID): User's contextual uploads - scoped to that project
 */

import { AppDataSource } from '../db/data-source.js'
import { ContentAsset } from '../db/entities/ContentAsset.js'
import { Trend } from '../db/entities/Trend.js'
import { Creator } from '../db/entities/Creator.js'
import { PlatformMetric } from '../db/entities/PlatformMetric.js'
import { generateEmbedding, searchSimilar } from './embeddings.js'

/**
 * Extract keywords from a concept for keyword-based search
 * Removes common words and extracts meaningful terms
 */
function extractKeywords(concept: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
    'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with',
    'create', 'make', 'using', 'use', 'help', 'need', 'want', 'how', 'what', 'when', 'where'
  ])

  const words = concept
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))

  // Return unique keywords
  return [...new Set(words)]
}

export interface RetrievalContext {
  projectContent: string[]    // Project-specific contextual uploads
  coreKnowledge: string[]     // Core RKB (trends, creators, industry examples)
  liveMetrics: string[]       // Real-time social data
  predictiveTrends: string[]  // Forecast signals
  sources: {
    project: string[]         // Attribution: which project files
    core: string[]            // Attribution: which RKB knowledge
    live: string[]            // Attribution: which APIs
    predictive: string[]      // Attribution: which forecasts
  }
}

/**
 * Retrieve relevant context from all knowledge sources for a given concept
 */
export async function retrieveContext(
  concept: string,
  userId: string | null,
  options: { maxResults?: number; includeCore?: boolean; includeLive?: boolean; projectId?: string | null } = {}
): Promise<RetrievalContext> {
  console.log('[RETRIEVAL] retrieveContext called:', { concept, userId, options })
  const { maxResults = 10, includeCore = true, includeLive = true, projectId = null } = options

  const context: RetrievalContext = {
    projectContent: [],
    coreKnowledge: [],
    liveMetrics: [],
    predictiveTrends: [],
    sources: { project: [], core: [], live: [], predictive: [] }
  }

  // Parallelize all retrieval queries for maximum performance
  console.log('[RETRIEVAL] Running parallel queries:', {
    projectId: !!projectId,
    includeCore,
    includeLive
  })

  const [projectAssets, coreData, liveData, predictive] = await Promise.all([
    // 1. Query project-specific content (if projectId provided)
    projectId
      ? retrieveProjectContent(projectId, concept, maxResults)
      : Promise.resolve({ content: [], sources: [] }),

    // 2. Query core RKB (platform knowledge + industry examples)
    includeCore
      ? retrieveCoreKnowledge(concept, maxResults)
      : Promise.resolve({ content: [], sources: [] }),

    // 3. Query live social metrics (if enabled)
    includeLive
      ? retrieveLiveMetrics(concept, maxResults)
      : Promise.resolve({ content: [], sources: [] }),

    // 4. Query predictive trends
    includeLive
      ? retrievePredictiveTrends(concept, maxResults)
      : Promise.resolve({ content: [], sources: [] })
  ])

  // Assign results to context
  context.projectContent = projectAssets.content
  context.sources.project = projectAssets.sources

  context.coreKnowledge = coreData.content
  context.sources.core = coreData.sources

  context.liveMetrics = liveData.content
  context.sources.live = liveData.sources

  context.predictiveTrends = predictive.content
  context.sources.predictive = predictive.sources

  // Dedupe sources to avoid double attribution and cap by maxResults
  const cap = (arr: string[]) => Array.from(new Set(arr)).slice(0, maxResults)
  context.sources.project = cap(context.sources.project)
  context.sources.core = cap(context.sources.core)
  context.sources.live = cap(context.sources.live)
  context.sources.predictive = cap(context.sources.predictive)

  console.log('[RETRIEVAL] Final context:', {
    projectContent: context.projectContent.length,
    coreKnowledge: context.coreKnowledge.length,
    liveMetrics: context.liveMetrics.length,
    predictiveTrends: context.predictiveTrends.length
  })

  return context
}

/**
 * Retrieve project-specific contextual uploads relevant to concept
 * Only returns content_assets where projectId matches (user's brief and context files)
 */
async function retrieveProjectContent(
  projectId: string,
  concept: string,
  limit: number
): Promise<{ content: string[]; sources: string[] }> {
  console.log('[PROJECT CONTENT] Retrieving content for projectId:', projectId, 'concept:', concept)

  // Generate embedding for the concept
  const conceptEmbedding = await generateEmbedding(concept)

  const repo = AppDataSource.getRepository(ContentAsset)

  if (!conceptEmbedding) {
    // Fallback to keyword-based text search
    console.log('[PROJECT CONTENT] No embedding, using keyword-based text search fallback')

    const keywords = extractKeywords(concept)
    console.log('[PROJECT CONTENT] Extracted keywords:', keywords)

    if (keywords.length === 0) {
      console.log('[PROJECT CONTENT] No keywords extracted, returning empty results')
      return { content: [], sources: [] }
    }

    // Build OR conditions for each keyword
    const conditions = keywords
      .map((_, i) => `(asset.name ILIKE :keyword${i} OR asset.metadata::text ILIKE :keyword${i} OR asset.tags::text ILIKE :keyword${i})`)
      .join(' OR ')

    const params: any = { projectId }
    keywords.forEach((kw, i) => {
      params[`keyword${i}`] = `%${kw}%`
    })

    const assets = await repo
      .createQueryBuilder('asset')
      .where('asset.projectId = :projectId', { projectId })
      .andWhere(`(${conditions})`, params)
      .orderBy('asset.createdAt', 'DESC')
      .limit(limit)
      .getMany()

    console.log('[PROJECT CONTENT] Found', assets.length, 'assets matching keywords')

    const content = assets.map(a => {
      const snippet = a.metadata?.insights?.snippet || a.metadata?.text || ''
      return `[${a.name}]: ${snippet}`
    })
    return { content, sources: assets.map(a => a.name) }
  }

  // Use semantic search with projectId filter
  // Note: searchSimilar currently filters by ownerId, we need to use raw query for projectId
  const embeddingStr = `[${conceptEmbedding.join(',')}]`
  const query = `
    SELECT *, 1 - (embedding <=> $1::vector) as similarity
    FROM content_assets
    WHERE embedding IS NOT NULL AND "projectId" = $2
    ORDER BY embedding <=> $1::vector
    LIMIT $3
  `
  const assets = await AppDataSource.query(query, [embeddingStr, projectId, limit])

  console.log('[PROJECT CONTENT] Found', assets.length, 'similar project assets')

  if (assets.length === 0) {
    console.log('[PROJECT CONTENT] Semantic search returned no results, falling back to keyword search')
    const keywords = extractKeywords(concept)
    console.log('[PROJECT CONTENT] Extracted keywords for fallback:', keywords)

    if (keywords.length > 0) {
      const conditions = keywords
        .map((_, i) => `(asset.name ILIKE :keyword${i} OR asset.metadata::text ILIKE :keyword${i} OR asset.tags::text ILIKE :keyword${i})`)
        .join(' OR ')
      const params: any = { projectId }
      keywords.forEach((kw, i) => {
        params[`keyword${i}`] = `%${kw}%`
      })

      const fallbackAssets = await repo
        .createQueryBuilder('asset')
        .where('asset.projectId = :projectId', { projectId })
        .andWhere(`(${conditions})`, params)
        .orderBy('asset.createdAt', 'DESC')
        .limit(limit)
        .getMany()

      console.log('[PROJECT CONTENT] Fallback found', fallbackAssets.length, 'assets')

      const content = fallbackAssets.map(a => {
        const snippet = a.metadata?.insights?.snippet || a.metadata?.text || ''
        return `[${a.name}]: ${snippet}`
      })
      return { content, sources: fallbackAssets.map(a => a.name) }
    }

    return { content: [], sources: [] }
  }

  const content = assets.map((a: any) => {
    const snippet = a.metadata?.insights?.snippet || a.metadata?.text || ''
    const similarity = ((a.similarity || 0) * 100).toFixed(1)
    return `[${a.name}] (${similarity}% match): ${snippet}`
  })

  let sources = assets.map((a: any) => a.name)

  // Include any non-embedded project assets so uploads are always referenced (fills gaps while embeddings are pending)
  try {
    const nonEmbedded = await AppDataSource.query(
      `SELECT * FROM content_assets WHERE embedding IS NULL AND "projectId" = $1 ORDER BY "createdAt" DESC`,
      [projectId]
    )
    if (nonEmbedded && nonEmbedded.length) {
      console.log('[PROJECT CONTENT] Including', nonEmbedded.length, 'non-embedded project assets')
      for (const a of nonEmbedded) {
        const snippet = a.metadata?.insights?.snippet || a.metadata?.text || ''
        content.push(`[${a.name}] (new upload): ${snippet}`)
        sources.push(a.name)
      }
    }
  } catch (e) {
    console.warn('[PROJECT CONTENT] Failed to include non-embedded assets:', e)
  }

  return { content, sources }
}

/**
 * Retrieve Core RKB (Ralph Knowledge Base)
 * Includes: trends, creators, and content_assets where projectId IS NULL (industry examples)
 */
async function retrieveCoreKnowledge(
  concept: string,
  limit: number
): Promise<{ content: string[]; sources: string[] }> {
  console.log('[CORE RKB] retrieveCoreKnowledge called:', { concept, limit })
  const content: string[] = []
  const sources: string[] = []

  // Generate embedding for the concept
  const conceptEmbedding = await generateEmbedding(concept)

  if (!conceptEmbedding) {
    // Fallback to keyword-based text search
    console.log('[CORE] No embedding, using keyword-based text search fallback')

    const keywords = extractKeywords(concept)
    console.log('[CORE] Extracted keywords:', keywords)

    if (keywords.length === 0) {
      console.log('[CORE] No keywords extracted, returning empty results')
      return { content, sources }
    }

    const trendRepo = AppDataSource.getRepository(Trend)

    // Build OR conditions for each keyword
    const trendConditions = keywords
      .map((_, i) => `(trend.label ILIKE :keyword${i} OR trend.signals::text ILIKE :keyword${i} OR trend.metrics::text ILIKE :keyword${i})`)
      .join(' OR ')

    const trendParams: any = {}
    keywords.forEach((kw, i) => {
      trendParams[`keyword${i}`] = `%${kw}%`
    })

    const trends = await trendRepo
      .createQueryBuilder('trend')
      .where(trendConditions, trendParams)
      .orderBy('trend.createdAt', 'DESC')
      .limit(Math.floor(limit / 3))
      .getMany()

    console.log('[CORE] Found', trends.length, 'trends matching keywords')

    for (const trend of trends) {
      const platformHint = trend.signals?.platform || 'multi-platform'
      content.push(`Trend: ${trend.label} (${platformHint})`)
      sources.push(`trend:${trend.label}`)
    }

    const creatorRepo = AppDataSource.getRepository(Creator)

    // Build OR conditions for each keyword
    const creatorConditions = keywords
      .map((_, i) => `(creator.name ILIKE :keyword${i} OR creator.platform ILIKE :keyword${i} OR creator.category ILIKE :keyword${i} OR creator.metadata::text ILIKE :keyword${i})`)
      .join(' OR ')

    const creatorParams: any = {}
    keywords.forEach((kw, i) => {
      creatorParams[`keyword${i}`] = `%${kw}%`
    })

    const creators = await creatorRepo
      .createQueryBuilder('creator')
      .where(creatorConditions, creatorParams)
      .orderBy('creator.createdAt', 'DESC')
      .limit(Math.floor(limit / 3))
      .getMany()

    console.log('[CORE] Found', creators.length, 'creators matching keywords')

    for (const creator of creators) {
      content.push(`Creator: ${creator.name} (${creator.platform})`)
      sources.push(`creator:${creator.name}`)
    }

    // Search RKB content_assets (projectId IS NULL)
    const assetRepo = AppDataSource.getRepository(ContentAsset)
    const assetConditions = keywords
      .map((_, i) => `(asset.name ILIKE :keyword${i} OR asset.metadata::text ILIKE :keyword${i} OR asset.tags::text ILIKE :keyword${i})`)
      .join(' OR ')

    const assetParams: any = {}
    keywords.forEach((kw, i) => {
      assetParams[`keyword${i}`] = `%${kw}%`
    })

    const rkbAssets = await assetRepo
      .createQueryBuilder('asset')
      .where('asset.projectId IS NULL')
      .andWhere(`(${assetConditions})`, assetParams)
      .orderBy('asset.createdAt', 'DESC')
      .limit(Math.floor(limit / 3))
      .getMany()

    console.log('[CORE] Found', rkbAssets.length, 'RKB assets matching keywords')

    for (const asset of rkbAssets) {
      const snippet = asset.metadata?.text || asset.metadata?.insights?.snippet || ''
      content.push(`RKB Example: ${asset.name} - ${snippet.substring(0, 100)}`)
      sources.push(`rkb:${asset.name}`)
    }

    return { content, sources }
  }

  // Parallelize all three semantic searches for better performance
  console.log('[CORE] Running parallel semantic searches for trends, creators, and RKB assets')
  const embeddingStr = `[${conceptEmbedding.join(',')}]`

  const [trends, creators, rkbAssets] = await Promise.all([
    // Search trends
    searchSimilar('trends', conceptEmbedding, Math.floor(limit / 3)),

    // Search creators
    searchSimilar('creators', conceptEmbedding, Math.floor(limit / 3)),

    // Search RKB content_assets (projectId IS NULL)
    AppDataSource.query(`
      SELECT *, 1 - (embedding <=> $1::vector) as similarity
      FROM content_assets
      WHERE embedding IS NOT NULL AND "projectId" IS NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `, [embeddingStr, Math.floor(limit / 3)])
  ])

  console.log('[CORE] Parallel search results:', {
    trends: trends.length,
    creators: creators.length,
    rkbAssets: rkbAssets.length
  })

  // Process trends results
  for (const trend of trends) {
    const platformHint = trend.signals?.platform || 'multi-platform'
    const similarity = ((trend.similarity || 0) * 100).toFixed(1)
    content.push(`Trend: ${trend.label} (${platformHint}, ${similarity}% match)`)
    sources.push(`trend:${trend.label}`)
  }

  // Process creators results
  for (const creator of creators) {
    const similarity = ((creator.similarity || 0) * 100).toFixed(1)
    content.push(`Creator: ${creator.name} (${creator.platform}, ${similarity}% match)`)
    sources.push(`creator:${creator.name}`)
  }

  // Process RKB assets results
  for (const asset of rkbAssets) {
    const snippet = asset.metadata?.text || asset.metadata?.insights?.snippet || ''
    const similarity = ((asset.similarity || 0) * 100).toFixed(1)
    content.push(`RKB Example: ${asset.name} (${similarity}% match) - ${snippet.substring(0, 100)}`)
    sources.push(`rkb:${asset.name}`)
  }

  // If semantic search returned no results, fall back to keyword search
  if (content.length === 0) {
    console.log('[CORE] Semantic search returned no results, falling back to keyword search')
    const keywords = extractKeywords(concept)
    console.log('[CORE] Extracted keywords for fallback:', keywords)

    if (keywords.length > 0) {
      const trendRepo = AppDataSource.getRepository(Trend)
      const trendConditions = keywords
        .map((_, i) => `(trend.label ILIKE :keyword${i} OR trend.signals::text ILIKE :keyword${i} OR trend.metrics::text ILIKE :keyword${i})`)
        .join(' OR ')
      const trendParams: any = {}
      keywords.forEach((kw, i) => {
        trendParams[`keyword${i}`] = `%${kw}%`
      })

      const fallbackTrends = await trendRepo
        .createQueryBuilder('trend')
        .where(trendConditions, trendParams)
        .orderBy('trend.createdAt', 'DESC')
        .limit(Math.floor(limit / 2))
        .getMany()

      console.log('[CORE] Fallback found', fallbackTrends.length, 'trends')

      for (const trend of fallbackTrends) {
        const platformHint = trend.signals?.platform || 'multi-platform'
        content.push(`Trend: ${trend.label} (${platformHint})`)
        sources.push(`trend:${trend.label}`)
      }

      const creatorRepo = AppDataSource.getRepository(Creator)
      const creatorConditions = keywords
        .map((_, i) => `(creator.name ILIKE :keyword${i} OR creator.platform ILIKE :keyword${i} OR creator.category ILIKE :keyword${i} OR creator.metadata::text ILIKE :keyword${i})`)
        .join(' OR ')
      const creatorParams: any = {}
      keywords.forEach((kw, i) => {
        creatorParams[`keyword${i}`] = `%${kw}%`
      })

      const fallbackCreators = await creatorRepo
        .createQueryBuilder('creator')
        .where(creatorConditions, creatorParams)
        .orderBy('creator.createdAt', 'DESC')
        .limit(Math.floor(limit / 2))
        .getMany()

      console.log('[CORE] Fallback found', fallbackCreators.length, 'creators')

      for (const creator of fallbackCreators) {
        content.push(`Creator: ${creator.name} (${creator.platform})`)
        sources.push(`creator:${creator.name}`)
      }
    }
  }

  console.log('[CORE] Total core knowledge items:', content.length)
  return { content, sources }
}

/**
 * Retrieve live social metrics from platform_metrics table
 * (Data populated by scheduled jobs from Apify/social APIs)
 */
async function retrieveLiveMetrics(
  concept: string,
  limit: number
): Promise<{ content: string[]; sources: string[] }> {
  // Prefer precomputed trend summaries to keep responses fast and deterministic
  try {
    const period = (process.env.RAG_SUMMARY_PERIOD as any) || 'week'
    const platform = 'all'
    const { getTrendSummary } = await import('./trendSummary.js')
    const summary: any = await getTrendSummary(period, platform)
    if (summary && Array.isArray(summary.items) && summary.items.length) {
      const items = summary.items.slice(0, limit)
      const content = items.map((m: any) => `[${(m.platform||'LIVE').toUpperCase()}] ${m.label || ''} (Engagement: ${m.engagement || 0}, Velocity: ${m.velocity || 0})`)
      const sources = items.map((m: any, idx: number) => liveSourceId({ platform: m.platform, metric_type: m.type, value: m.value, createdAt: m.createdAt, engagement: m.engagement, velocity: m.velocity }, idx))
      return { content, sources }
    }
  } catch (e) {
    console.warn('[LIVE METRICS] Summary fetch failed or empty; falling back to raw metrics')
  }
  console.log('[LIVE METRICS] Retrieving metrics for concept:', concept)

  // Query recent metrics (last 7 days)
  // Configurable live window (days)
  const days = Number(process.env.LIVE_WINDOW_DAYS || 7)
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Extract keywords from concept for better matching
  const keywords = extractKeywords(concept)
  console.log('[LIVE METRICS] Extracted keywords:', keywords)

  if (keywords.length === 0) {
    console.log('[LIVE METRICS] No keywords extracted, returning top trending items')
    // Fallback: return top trending items by engagement
    const topMetrics = await AppDataSource.query(`
      SELECT platform, metric_type, value, engagement, velocity, metadata, "createdAt"
      FROM platform_metrics
      WHERE "createdAt" > $1
      ORDER BY engagement DESC, velocity DESC
      LIMIT $2
    `, [sinceDate, limit])

    const content = topMetrics.map((m: any) => formatMetricContent(m))
    const sources = topMetrics.map((m: any, idx: number) => liveSourceId(m, idx))
    console.log('[LIVE METRICS] Returning', content.length, 'top trending items')
    return { content, sources }
  }

  // Build search condition for JSONB value field
  // Search in the actual trend content (hashtags, titles, descriptions, etc.)
  const searchConditions = keywords
    .map((_, i) => `value::text ILIKE $${i + 3}`)
    .join(' OR ')

  const params = [
    sinceDate,
    limit,
    ...keywords.map(kw => `%${kw}%`)
  ]

  const query = `
    SELECT platform, metric_type, value, engagement, velocity, metadata, "createdAt"
    FROM platform_metrics
    WHERE "createdAt" > $1
      AND (${searchConditions})
    ORDER BY engagement DESC, velocity DESC, "createdAt" DESC
    LIMIT $2
  `

  console.log('[LIVE METRICS] Running query with', keywords.length, 'keywords')
  let metrics = await AppDataSource.query(query, params)

  console.log('[LIVE METRICS] Found', metrics.length, 'matching metrics')

  // If keyword match is sparse, top up with top trending to reach desired limit
  if (metrics.length < Math.min(5, limit)) {
    const fill = await AppDataSource.query(`
      SELECT platform, metric_type, value, engagement, velocity, metadata, "createdAt"
      FROM platform_metrics
      WHERE "createdAt" > $1
      ORDER BY engagement DESC, velocity DESC
      LIMIT $2
    `, [sinceDate, limit - metrics.length])
    metrics = [...metrics, ...fill]
  }

  const content = metrics.map((m: any) => formatMetricContent(m))
  const sources = metrics.map((m: any, idx: number) => liveSourceId(m, idx))

  return { content, sources }
}

/**
 * Format a platform metric into human-readable content for the AI
 */
function formatMetricContent(metric: any): string {
  const platform = metric.platform.toUpperCase()
  const value = metric.value || {}
  const engagement = metric.engagement || 0
  // Handle velocity - convert to number if string, handle null/undefined
  const velocityNum = typeof metric.velocity === 'number'
    ? metric.velocity
    : typeof metric.velocity === 'string'
      ? parseFloat(metric.velocity)
      : 0
  const velocity = !isNaN(velocityNum) ? velocityNum.toFixed(2) : '0.00'

  // Platform-specific formatting
  switch (metric.platform) {
    case 'tiktok':
      return `[${platform}] ${value.description || 'No description'} (Engagement: ${engagement}, Velocity: ${velocity}/hr)`

    case 'instagram':
      // Extract first line of caption + hashtags
      const caption = (value.caption || '').split('\n')[0].substring(0, 150)
      return `[${platform}] ${caption}${caption.length >= 150 ? '...' : ''} (Likes: ${value.likesCount || 0}, Comments: ${value.commentsCount || 0})`

    case 'news':
      return `[${platform}] "${value.title || 'Untitled'}" - ${value.source || 'Unknown source'}`

    case 'fandom':
      return `[${platform}] ${value.title || 'Untitled'} (Entertainment trending)`

    default:
      return `[${platform}] ${JSON.stringify(value).substring(0, 100)}`
  }
}

// Create a unique, stable-ish id for each live metric so source counts reflect items, not just platforms
function liveSourceId(m: any, idx: number): string {
  const plat = (m.platform || 'live').toString().toLowerCase()
  const typ = (m.metric_type || 'metric').toString().toLowerCase()
  const ts = (m.createdAt ? new Date(m.createdAt).toISOString() : `idx${idx}`)
  // Extract a compact token from value (title/hashtag/id if present)
  let token = ''
  try {
    const v = m.value || {}
    token = v.id || v.hashtag || v.title || v.caption || ''
    if (typeof token !== 'string') token = JSON.stringify(v).slice(0, 24)
  } catch { token = '' }
  token = (token || '').toString().replace(/\s+/g, '-').slice(0, 24)
  return `${plat}:${typ}:${ts}:${token}`
}

/**
 * Retrieve predictive trend forecasts
 * (Data from Google Trends API, scheduled updates)
 */
async function retrievePredictiveTrends(
  concept: string,
  limit: number
): Promise<{ content: string[]; sources: string[] }> {
  // TODO: Implement once we add trend_forecasts table
  // For now: return empty
  return { content: [], sources: [] }
}

/**
 * Format retrieval context into a prompt-ready string
 */
export function formatContextForPrompt(context: RetrievalContext): string {
  // Bound the context so we never blow the model context window
  const clampLines = (items: string[], maxItems: number, maxLen: number) => {
    return items.slice(0, maxItems).map(s => s.length > maxLen ? (s.slice(0, maxLen - 1) + '…') : s)
  }
  const sec = (title: string, items: string[]) => items.length ? `## ${title}:\n${items.join('\n')}` : ''

  const proj = clampLines(context.projectContent || [], 6, 220)
  const core = clampLines(context.coreKnowledge || [], 6, 220)
  const live = clampLines(context.liveMetrics || [], 6, 220)
  const pred = clampLines(context.predictiveTrends || [], 6, 220)

  const sections = [
    sec('Project Contextual Files', proj),
    sec('Ralph Knowledge Base (RKB)', core),
    sec('Live Social Trends (Last 7 Days)', live),
    sec('Predicted Trend Forecasts', pred),
  ].filter(Boolean)

  // Hard budget ~1800 chars; drop least-critical sections last
  let out = sections.join('\n\n')
  const dropOrder = ['Predicted Trend Forecasts', 'Project Contextual Files']
  let i = 0
  while (out.length > 1800 && i < dropOrder.length) {
    const title = dropOrder[i++]
    out = out.replace(new RegExp(`## ${title}:[\s\S]*?(?=\n\n## |$)`, 'm'), '').trim()
  }
  return out
}
