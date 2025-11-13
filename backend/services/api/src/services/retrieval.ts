/**
 * Multi-Source RAG Retrieval Service
 *
 * Retrieves context from multiple knowledge sources:
 * 1. User Personal KB (uploaded files)
 * 2. Core RKB (platform trends, creators, patterns)
 * 3. Live Social Data (Apify, platform APIs)
 * 4. Predictive Trends (Google Trends, forecasts)
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
  userContent: string[]      // User's uploaded files
  coreKnowledge: string[]    // Platform trends, creators, patterns
  liveMetrics: string[]      // Real-time social data
  predictiveTrends: string[] // Forecast signals
  sources: {
    user: string[]           // Attribution: which user files
    core: string[]           // Attribution: which core knowledge
    live: string[]           // Attribution: which APIs
    predictive: string[]     // Attribution: which forecasts
  }
}

/**
 * Retrieve relevant context from all knowledge sources for a given concept
 */
export async function retrieveContext(
  concept: string,
  userId: string | null,
  options: { maxResults?: number; includeCore?: boolean; includeLive?: boolean } = {}
): Promise<RetrievalContext> {
  console.log('[RETRIEVAL] retrieveContext called:', { concept, userId, options })
  const { maxResults = 10, includeCore = true, includeLive = true } = options

  const context: RetrievalContext = {
    userContent: [],
    coreKnowledge: [],
    liveMetrics: [],
    predictiveTrends: [],
    sources: { user: [], core: [], live: [], predictive: [] }
  }

  // 1. Query user's personal KB (if logged in)
  if (userId) {
    console.log('[RETRIEVAL] Querying user content for userId:', userId)
    const userAssets = await retrieveUserContent(userId, concept, maxResults)
    console.log('[RETRIEVAL] User content found:', userAssets.content.length, 'items')
    context.userContent = userAssets.content
    context.sources.user = userAssets.sources
  } else {
    console.log('[RETRIEVAL] Skipping user content (no userId)')
  }

  // 2. Query core RKB (platform knowledge)
  if (includeCore) {
    console.log('[RETRIEVAL] Querying core knowledge...')
    const coreData = await retrieveCoreKnowledge(concept, maxResults)
    console.log('[RETRIEVAL] Core knowledge found:', coreData.content.length, 'items')
    context.coreKnowledge = coreData.content
    context.sources.core = coreData.sources
  }

  // 3. Query live social metrics (if enabled)
  if (includeLive) {
    console.log('[RETRIEVAL] Querying live metrics...')
    const liveData = await retrieveLiveMetrics(concept, maxResults)
    console.log('[RETRIEVAL] Live metrics found:', liveData.content.length, 'items')
    context.liveMetrics = liveData.content
    context.sources.live = liveData.sources
  }

  // 4. Query predictive trends
  if (includeLive) {
    console.log('[RETRIEVAL] Querying predictive trends...')
    const predictive = await retrievePredictiveTrends(concept, maxResults)
    console.log('[RETRIEVAL] Predictive trends found:', predictive.content.length, 'items')
    context.predictiveTrends = predictive.content
    context.sources.predictive = predictive.sources
  }

  console.log('[RETRIEVAL] Final context:', {
    userContent: context.userContent.length,
    coreKnowledge: context.coreKnowledge.length,
    liveMetrics: context.liveMetrics.length,
    predictiveTrends: context.predictiveTrends.length
  })

  return context
}

/**
 * Retrieve user's uploaded content relevant to concept
 */
async function retrieveUserContent(
  userId: string,
  concept: string,
  limit: number
): Promise<{ content: string[]; sources: string[] }> {
  console.log('[USER CONTENT] Retrieving content for user:', userId, 'concept:', concept)

  // Generate embedding for the concept
  const conceptEmbedding = await generateEmbedding(concept)

  if (!conceptEmbedding) {
    // Fallback to keyword-based text search
    console.log('[USER CONTENT] No embedding, using keyword-based text search fallback')

    const keywords = extractKeywords(concept)
    console.log('[USER CONTENT] Extracted keywords:', keywords)

    if (keywords.length === 0) {
      console.log('[USER CONTENT] No keywords extracted, returning empty results')
      return { content: [], sources: [] }
    }

    const repo = AppDataSource.getRepository(ContentAsset)

    // Build OR conditions for each keyword
    const conditions = keywords
      .map((_, i) => `(asset.name ILIKE :keyword${i} OR asset.metadata::text ILIKE :keyword${i} OR asset.tags::text ILIKE :keyword${i})`)
      .join(' OR ')

    const params: any = { userId }
    keywords.forEach((kw, i) => {
      params[`keyword${i}`] = `%${kw}%`
    })

    const assets = await repo
      .createQueryBuilder('asset')
      .where('asset.ownerId = :userId', { userId })
      .andWhere(`(${conditions})`, params)
      .orderBy('asset.createdAt', 'DESC')
      .limit(limit)
      .getMany()

    console.log('[USER CONTENT] Found', assets.length, 'assets matching keywords')

    const content = assets.map(a => {
      const snippet = a.metadata?.insights?.snippet || a.metadata?.text || ''
      return `[${a.name}]: ${snippet}`
    })
    return { content, sources: assets.map(a => a.name) }
  }

  // Use semantic search
  const assets = await searchSimilar('content_assets', conceptEmbedding, limit, { ownerId: userId })

  console.log('[USER CONTENT] Found', assets.length, 'similar assets')

  if (assets.length === 0) {
    console.log('[USER CONTENT] Semantic search returned no results, falling back to keyword search')
    const keywords = extractKeywords(concept)
    console.log('[USER CONTENT] Extracted keywords for fallback:', keywords)

    if (keywords.length > 0) {
      const repo = AppDataSource.getRepository(ContentAsset)
      const conditions = keywords
        .map((_, i) => `(asset.name ILIKE :keyword${i} OR asset.metadata::text ILIKE :keyword${i} OR asset.tags::text ILIKE :keyword${i})`)
        .join(' OR ')
      const params: any = { userId }
      keywords.forEach((kw, i) => {
        params[`keyword${i}`] = `%${kw}%`
      })

      const fallbackAssets = await repo
        .createQueryBuilder('asset')
        .where('asset.ownerId = :userId', { userId })
        .andWhere(`(${conditions})`, params)
        .orderBy('asset.createdAt', 'DESC')
        .limit(limit)
        .getMany()

      console.log('[USER CONTENT] Fallback found', fallbackAssets.length, 'assets')

      const content = fallbackAssets.map(a => {
        const snippet = a.metadata?.insights?.snippet || a.metadata?.text || ''
        return `[${a.name}]: ${snippet}`
      })
      return { content, sources: fallbackAssets.map(a => a.name) }
    }

    return { content: [], sources: [] }
  }

  const content = assets.map(a => {
    const snippet = a.metadata?.insights?.snippet || a.metadata?.text || ''
    const similarity = ((a.similarity || 0) * 100).toFixed(1)
    return `[${a.name}] (${similarity}% match): ${snippet}`
  })

  const sources = assets.map(a => a.name)

  return { content, sources }
}

/**
 * Retrieve platform core knowledge (trends, creators, patterns)
 */
async function retrieveCoreKnowledge(
  concept: string,
  limit: number
): Promise<{ content: string[]; sources: string[] }> {
  console.log('[CORE] retrieveCoreKnowledge called:', { concept, limit })
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
      .limit(Math.floor(limit / 2))
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
      .limit(Math.floor(limit / 2))
      .getMany()

    console.log('[CORE] Found', creators.length, 'creators matching keywords')

    for (const creator of creators) {
      content.push(`Creator: ${creator.name} (${creator.platform})`)
      sources.push(`creator:${creator.name}`)
    }

    return { content, sources }
  }

  // Use semantic search for trends
  console.log('[CORE] Using semantic search for trends')
  const trends = await searchSimilar('trends', conceptEmbedding, Math.floor(limit / 2))
  console.log('[CORE] Found', trends.length, 'similar trends')

  for (const trend of trends) {
    const platformHint = trend.signals?.platform || 'multi-platform'
    const similarity = ((trend.similarity || 0) * 100).toFixed(1)
    content.push(`Trend: ${trend.label} (${platformHint}, ${similarity}% match)`)
    sources.push(`trend:${trend.label}`)
  }

  // Use semantic search for creators
  console.log('[CORE] Using semantic search for creators')
  const creators = await searchSimilar('creators', conceptEmbedding, Math.floor(limit / 2))
  console.log('[CORE] Found', creators.length, 'similar creators')

  for (const creator of creators) {
    const similarity = ((creator.similarity || 0) * 100).toFixed(1)
    content.push(`Creator: ${creator.name} (${creator.platform}, ${similarity}% match)`)
    sources.push(`creator:${creator.name}`)
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
  const repo = AppDataSource.getRepository(PlatformMetric)

  // Query recent metrics (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const metrics = await repo
    .createQueryBuilder('metric')
    .where('metric.createdAt > :cutoff', { cutoff: sevenDaysAgo })
    .andWhere(
      `metric.platform ILIKE :search`,
      { search: `%${concept}%` }
    )
    .orderBy('metric.createdAt', 'DESC')
    .limit(limit)
    .getMany()

  const content = metrics.map(m => {
    return `[${m.platform}] Engagement: ${m.engagement}, Velocity: ${m.velocity}`
  })

  const sources = metrics.map(m => `${m.platform}:live`)

  return { content, sources }
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
  const sections: string[] = []

  if (context.userContent.length > 0) {
    sections.push(`## Your Knowledge Base:\n${context.userContent.join('\n')}`)
  }

  if (context.coreKnowledge.length > 0) {
    sections.push(`## Platform Knowledge:\n${context.coreKnowledge.join('\n')}`)
  }

  if (context.liveMetrics.length > 0) {
    sections.push(`## Live Trends (Last 7 Days):\n${context.liveMetrics.join('\n')}`)
  }

  if (context.predictiveTrends.length > 0) {
    sections.push(`## Predicted Trends:\n${context.predictiveTrends.join('\n')}`)
  }

  return sections.join('\n\n')
}
