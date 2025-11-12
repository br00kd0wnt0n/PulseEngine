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
    const userAssets = await retrieveUserContent(userId, concept, maxResults)
    context.userContent = userAssets.content
    context.sources.user = userAssets.sources
  }

  // 2. Query core RKB (platform knowledge)
  if (includeCore) {
    const coreData = await retrieveCoreKnowledge(concept, maxResults)
    context.coreKnowledge = coreData.content
    context.sources.core = coreData.sources
  }

  // 3. Query live social metrics (if enabled)
  if (includeLive) {
    const liveData = await retrieveLiveMetrics(concept, maxResults)
    context.liveMetrics = liveData.content
    context.sources.live = liveData.sources
  }

  // 4. Query predictive trends
  if (includeLive) {
    const predictive = await retrievePredictiveTrends(concept, maxResults)
    context.predictiveTrends = predictive.content
    context.sources.predictive = predictive.sources
  }

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
  const repo = AppDataSource.getRepository(ContentAsset)

  // For now: simple text search in metadata
  // TODO: Replace with semantic vector search
  const assets = await repo
    .createQueryBuilder('asset')
    .where('asset.ownerId = :userId', { userId })
    .andWhere(
      `(asset.name ILIKE :search OR asset.metadata::text ILIKE :search OR asset.tags::text ILIKE :search)`,
      { search: `%${concept}%` }
    )
    .orderBy('asset.createdAt', 'DESC')
    .limit(limit)
    .getMany()

  const content = assets.map(a => {
    const snippet = a.metadata?.insights?.snippet || a.metadata?.text || ''
    return `[${a.name}]: ${snippet}`
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
  const content: string[] = []
  const sources: string[] = []

  // Query trends table
  const trendRepo = AppDataSource.getRepository(Trend)
  const trends = await trendRepo
    .createQueryBuilder('trend')
    .where(
      `(trend.label ILIKE :search OR trend.signals::text ILIKE :search OR trend.metrics::text ILIKE :search)`,
      { search: `%${concept}%` }
    )
    .orderBy('trend.createdAt', 'DESC')
    .limit(Math.floor(limit / 2))
    .getMany()

  for (const trend of trends) {
    const platformHint = trend.signals?.platform || 'multi-platform'
    content.push(`Trend: ${trend.label} (${platformHint})`)
    sources.push(`trend:${trend.label}`)
  }

  // Query creators table
  const creatorRepo = AppDataSource.getRepository(Creator)
  const creators = await creatorRepo
    .createQueryBuilder('creator')
    .where(
      `(creator.name ILIKE :search OR creator.platform ILIKE :search OR creator.category ILIKE :search OR creator.metadata::text ILIKE :search)`,
      { search: `%${concept}%` }
    )
    .orderBy('creator.createdAt', 'DESC')
    .limit(Math.floor(limit / 2))
    .getMany()

  for (const creator of creators) {
    content.push(`Creator: ${creator.name} (${creator.platform})`)
    sources.push(`creator:${creator.name}`)
  }

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
