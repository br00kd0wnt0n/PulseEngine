# External API Integration Plan

## Overview
Integrate live social data and predictive trend forecasting into the RAG knowledge base.

## 1. Apify Integration (Social Media Data)

### Available Actors:
- **TikTok Scraper** - Trending videos, hashtags, sound usage
- **Instagram Profile Scraper** - Engagement metrics, post performance
- **YouTube Scraper** - Video trends, engagement data

### Implementation:
```typescript
// services/external/apify.ts
import { ApifyClient } from 'apify-client'

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN
})

export async function scrape TikTokTrends(hashtag?: string) {
  const run = await client.actor('clockworks/tiktok-scraper').call({
    hashtags: [hashtag || 'viral'],
    maxItems: 50,
    resultsPerPage: 50
  })

  const { items } = await client.dataset(run.defaultDatasetId).listItems()
  return items
}
```

### Data Storage:
- **Table**: `platform_metrics`
- **Columns**:
  - platform (tiktok, instagram, youtube)
  - metric_type (trending_hashtag, viral_sound, creator_engagement)
  - value (JSON with metrics)
  - metadata (additional context)
  - createdAt (for time-based queries)

### Scheduled Jobs:
- Run every 6 hours
- Store in platform_metrics table
- Query last 7 days for retrieval

## 2. Google Trends API

### Option A: Official API (pytrends/Serpapi)
```typescript
// services/external/google-trends.ts
import axios from 'axios'

export async function getTrendingSearches(geo = 'US') {
  const url = `https://serpapi.com/search.json?engine=google_trends_trending_now&geo=${geo}&api_key=${process.env.SERPAPI_KEY}`
  const { data } = await axios.get(url)
  return data.trending_searches
}

export async function getInterestOverTime(keyword: string) {
  const url = `https://serpapi.com/search.json?engine=google_trends&q=${keyword}&data_type=TIMESERIES&api_key=${process.env.SERPAPI_KEY}`
  const { data } = await axios.get(url)
  return data.interest_over_time
}
```

### Option B: Glimpse Integration
- Check if Glimpse has a public API
- If not, consider scraping (with rate limiting) or using their embed widgets

### Data Storage:
- **Table**: `trend_forecasts`
- **Columns**:
  - keyword
  - current_interest (0-100)
  - predicted_peak (date estimate)
  - growth_velocity
  - geographic_data (JSON)
  - source (google_trends, glimpse)
  - createdAt

## 3. Migration: Add New Tables

```typescript
// Create migration for platform_metrics and trend_forecasts
export class ExternalDataTables implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // platform_metrics table
    await queryRunner.query(`
      CREATE TABLE platform_metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        platform VARCHAR(50) NOT NULL,
        metric_type VARCHAR(100) NOT NULL,
        value JSONB NOT NULL,
        metadata JSONB DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_platform_metrics_created ON platform_metrics("createdAt");
      CREATE INDEX idx_platform_metrics_platform ON platform_metrics(platform);
    `)

    // trend_forecasts table
    await queryRunner.query(`
      CREATE TABLE trend_forecasts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        keyword VARCHAR(255) NOT NULL,
        current_interest INTEGER NOT NULL,
        predicted_peak TIMESTAMP,
        growth_velocity DECIMAL(10,2),
        geographic_data JSONB DEFAULT '{}',
        source VARCHAR(50) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_trend_forecasts_keyword ON trend_forecasts(keyword);
      CREATE INDEX idx_trend_forecasts_created ON trend_forecasts("createdAt");
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE trend_forecasts;`)
    await queryRunner.query(`DROP TABLE platform_metrics;`)
  }
}
```

## 4. Scheduled Data Collection

### Option A: Node-cron
```typescript
// services/scheduler/trends-collector.ts
import cron from 'node-cron'
import { scrapeTikTokTrends } from '../external/apify.js'
import { getTrendingSearches } from '../external/google-trends.js'

// Run every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('Collecting trending data...')

  // Collect TikTok trends
  const tiktokData = await scrapeTikTokTrends()
  await saveToPlatformMetrics('tiktok', tiktokData)

  // Collect Google Trends
  const googleData = await getTrendingSearches()
  await saveToTrendForecasts(googleData)

  console.log('Data collection complete')
})
```

### Option B: Railway Cron Jobs
- Set up scheduled tasks in Railway dashboard
- POST to `/admin/collect-trends` endpoint

## 5. API Cost Estimates

### Apify:
- Free tier: $5 credit/month
- Pay-as-you-go: ~$0.25 per 1K results
- Estimated monthly: $10-20 for moderate usage

### SerpApi (Google Trends):
- Free tier: 100 searches/month
- Paid: $50/month for 5K searches
- Alternative: Use unofficial python library (free but less reliable)

### Recommended Start:
1. Apify free tier for TikTok/Instagram
2. Unofficial google-trends-api npm package (free)
3. Upgrade to paid if data quality/volume needed

## 6. Implementation Priority

### Phase 1 (Immediate):
- [x] Create retrieval.ts service
- [ ] Add platform_metrics and trend_forecasts tables (migration)
- [ ] Implement Apify TikTok scraper
- [ ] Test with existing seed data

### Phase 2 (Week 2):
- [ ] Add Google Trends integration
- [ ] Set up scheduled jobs (cron)
- [ ] Test full retrieval flow with live data

### Phase 3 (Week 3):
- [ ] Add Instagram/YouTube scrapers
- [ ] Implement trend velocity calculations
- [ ] Add geographic breakdown

### Phase 4 (Future):
- [ ] Explore Glimpse API or alternatives
- [ ] Add sentiment analysis (Hugging Face API)
- [ ] Real-time WebSocket updates for hot trends

## 7. Environment Variables Needed

```bash
# Apify
APIFY_API_TOKEN=your_token_here

# Google Trends (SerpApi)
SERPAPI_KEY=your_key_here  # Optional, fallback to unofficial lib

# Scheduling
ENABLE_TREND_COLLECTION=true
TREND_COLLECTION_INTERVAL=6  # hours
```

## 8. Monitoring & Alerts

- Log all API calls with timestamps
- Alert if external API fails (>3 consecutive failures)
- Track API usage/costs
- Monitor stale data (no updates >12 hours)
