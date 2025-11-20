/**
 * Simple in-memory LRU cache for embeddings and search results
 * For production, replace with Redis or similar
 */

interface CacheEntry<T> {
  value: T
  timestamp: number
  hits: number
}

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private maxSize: number
  private ttl: number // Time to live in milliseconds

  constructor(maxSize: number = 1000, ttlMinutes: number = 60) {
    this.maxSize = maxSize
    this.ttl = ttlMinutes * 60 * 1000
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    // Update hits for LRU tracking
    entry.hits++

    return entry.value
  }

  set(key: string, value: T): void {
    // If cache is full, remove least recently used item
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0
    })
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  private evictLRU(): void {
    // Find entry with lowest hits (least recently used)
    let lruKey: string | null = null
    let minHits = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits) {
        minHits = entry.hits
        lruKey = key
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey)
    }
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  stats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    }
  }
}

// Singleton cache instances
export const embeddingCache = new LRUCache<number[]>(500, 120) // 500 embeddings, 2hr TTL
export const searchResultCache = new LRUCache<any>(200, 30) // 200 search results (arrays or objects), 30min TTL

/**
 * Generate a cache key from query parameters
 */
export function generateCacheKey(type: string, ...params: any[]): string {
  return `${type}:${params.map(p => JSON.stringify(p)).join(':')}`
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  embeddingCache.clear()
  searchResultCache.clear()
  console.log('[CACHE] All caches cleared')
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    embeddings: embeddingCache.stats(),
    searchResults: searchResultCache.stats()
  }
}
