import cron from 'node-cron'
import { collectAllMetrics, cleanupOldMetrics } from '../external/apify.js'

/**
 * Daily trend collection scheduler
 * Runs at 3 AM every day
 */
export function startTrendCollector() {
  const enabled = process.env.ENABLE_TREND_COLLECTION !== 'false' // Enabled by default

  if (!enabled) {
    console.log('[SCHEDULER] Trend collection disabled via ENABLE_TREND_COLLECTION')
    return
  }

  console.log('[SCHEDULER] Starting daily trend collection job')

  // Run at 3 AM every day
  cron.schedule('0 3 * * *', async () => {
    console.log('[SCHEDULER] Running daily trend collection...')

    try {
      // 1. Collect fresh data from all Apify actors
      const results = await collectAllMetrics()
      console.log('[SCHEDULER] Collection complete:', results)

      // 2. Cleanup old data (keep last 30 days)
      const deleted = await cleanupOldMetrics(30)
      console.log('[SCHEDULER] Cleanup complete, deleted:', deleted)

    } catch (error) {
      console.error('[SCHEDULER] Daily collection failed:', error)
    }
  })

  console.log('[SCHEDULER] Daily job scheduled for 3 AM')

  // Optional: Run immediately on startup for testing
  if (process.env.RUN_COLLECTION_ON_STARTUP === 'true') {
    console.log('[SCHEDULER] Running initial collection on startup...')
    collectAllMetrics()
      .then(results => console.log('[SCHEDULER] Initial collection complete:', results))
      .catch(err => console.error('[SCHEDULER] Initial collection failed:', err))
  }
}

/**
 * Stop the trend collector (for graceful shutdown)
 */
export function stopTrendCollector() {
  console.log('[SCHEDULER] Stopping trend collection job')
  cron.getTasks().forEach(task => task.stop())
}
