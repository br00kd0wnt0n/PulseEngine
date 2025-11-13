/**
 * Embedding Generation Service
 *
 * Generates vector embeddings using OpenAI's text-embedding-3-small model (1536 dimensions)
 * Used for semantic search in RAG retrieval system
 */

import crypto from 'crypto'
import { AppDataSource } from '../db/data-source.js'

// Simple in-memory cache for embeddings (keyed by text hash)
const embeddingCache = new Map<string, number[]>()

function textHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

/**
 * Generate embedding for a single text string
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const hash = textHash(text)

  // Check cache first
  if (embeddingCache.has(hash)) {
    console.log('[EMBEDDING] Cache hit for text:', text.substring(0, 50))
    return embeddingCache.get(hash)!
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[EMBEDDING] No OPENAI_API_KEY, skipping embedding generation')
    return null
  }

  try {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey })

    console.log('[EMBEDDING] Generating embedding for:', text.substring(0, 50))
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    })

    const embedding = response.data[0].embedding

    // Cache the result
    embeddingCache.set(hash, embedding)

    return embedding
  } catch (error) {
    console.error('[EMBEDDING] Failed to generate embedding:', error)
    return null
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient than calling generateEmbedding multiple times
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[EMBEDDING] No OPENAI_API_KEY, skipping batch embedding generation')
    return texts.map(() => null)
  }

  // Check cache for all texts first
  const results: (number[] | null)[] = []
  const uncachedTexts: string[] = []
  const uncachedIndexes: number[] = []

  for (let i = 0; i < texts.length; i++) {
    const hash = textHash(texts[i])
    if (embeddingCache.has(hash)) {
      results[i] = embeddingCache.get(hash)!
      console.log(`[EMBEDDING] Cache hit for text ${i+1}/${texts.length}`)
    } else {
      results[i] = null // placeholder
      uncachedTexts.push(texts[i])
      uncachedIndexes.push(i)
    }
  }

  // Generate embeddings for uncached texts
  if (uncachedTexts.length === 0) {
    console.log('[EMBEDDING] All embeddings from cache')
    return results
  }

  try {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey })

    console.log(`[EMBEDDING] Generating ${uncachedTexts.length} embeddings in batch`)
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: uncachedTexts,
      encoding_format: 'float'
    })

    // Fill in the results and update cache
    for (let i = 0; i < uncachedTexts.length; i++) {
      const embedding = response.data[i].embedding
      const originalIndex = uncachedIndexes[i]
      results[originalIndex] = embedding

      const hash = textHash(uncachedTexts[i])
      embeddingCache.set(hash, embedding)
    }

    console.log(`[EMBEDDING] Generated ${uncachedTexts.length} embeddings successfully`)
    return results
  } catch (error) {
    console.error('[EMBEDDING] Failed to generate batch embeddings:', error)
    return results.map((r, i) => r || null)
  }
}

/**
 * Format text for embedding generation from a trend
 */
export function formatTrendForEmbedding(trend: { label: string; signals?: any; metrics?: any }): string {
  const parts = [trend.label]

  if (trend.signals) {
    const platform = trend.signals.platform || ''
    const category = trend.signals.category || ''
    if (platform) parts.push(`platform: ${platform}`)
    if (category) parts.push(`category: ${category}`)
  }

  return parts.join(', ')
}

/**
 * Format text for embedding generation from a creator
 */
export function formatCreatorForEmbedding(creator: { name: string; platform?: string; category?: string }): string {
  const parts = [creator.name]
  if (creator.platform) parts.push(`platform: ${creator.platform}`)
  if (creator.category) parts.push(`category: ${creator.category}`)
  return parts.join(', ')
}

/**
 * Format text for embedding generation from a content asset
 */
export function formatAssetForEmbedding(asset: { name: string; metadata?: any; tags?: any }): string {
  const parts = [asset.name]

  if (asset.metadata?.text) {
    // Include first 200 chars of extracted text
    parts.push(asset.metadata.text.substring(0, 200))
  }

  if (asset.tags?.list && Array.isArray(asset.tags.list)) {
    parts.push(`tags: ${asset.tags.list.join(', ')}`)
  }

  return parts.join(', ')
}

/**
 * Perform cosine similarity search
 * Returns rows ordered by similarity (most similar first)
 */
export async function searchSimilar(
  table: 'trends' | 'creators' | 'content_assets',
  queryEmbedding: number[],
  limit: number = 5,
  filters?: { ownerId?: string }
): Promise<any[]> {
  const embeddingStr = `[${queryEmbedding.join(',')}]`

  let query = `
    SELECT *, 1 - (embedding <=> $1::vector) as similarity
    FROM ${table}
    WHERE embedding IS NOT NULL
  `

  const params: any[] = [embeddingStr]
  let paramIndex = 2

  if (filters?.ownerId) {
    query += ` AND "ownerId" = $${paramIndex}`
    params.push(filters.ownerId)
    paramIndex++
  }

  query += ` ORDER BY embedding <=> $1::vector LIMIT $${paramIndex}`
  params.push(limit)

  console.log(`[EMBEDDING] Searching ${table} for similar vectors (limit: ${limit})`)

  try {
    const results = await AppDataSource.query(query, params)
    console.log(`[EMBEDDING] Found ${results.length} similar items in ${table}`)
    return results
  } catch (error) {
    console.error(`[EMBEDDING] Search failed for ${table}:`, error)
    return []
  }
}
