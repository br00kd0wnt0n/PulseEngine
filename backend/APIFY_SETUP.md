# Apify Daily Trend Collection Setup

## Overview
Automated daily scraping of trending content from 7 platforms:
- TikTok (hashtags)
- Instagram (hashtags)
- Twitter/X (tweets)
- YouTube (videos)
- Google News
- Wikipedia
- Fandom

## Environment Variables

Add these to your `.env` file or Railway environment:

```bash
# Apify Configuration
APIFY_API_TOKEN=apify_api_97WtfbBow3LOSbzNIOVUBNpED9NNNM2cXyIS
APIFY_USER_ID=ZHpVFG3nnyXUci0hf

# Trend Collection Settings
ENABLE_TREND_COLLECTION=true          # Enable/disable scheduled collection
RUN_COLLECTION_ON_STARTUP=false       # Set to 'true' for testing (runs immediately)
```

## Railway Setup

### 1. Add Environment Variables
In Railway dashboard → Variables:
```
APIFY_API_TOKEN=apify_api_97WtfbBow3LOSbzNIOVUBNpED9NNNM2cXyIS
ENABLE_TREND_COLLECTION=true
```

### 2. Deploy
The scheduler will automatically start when the API service deploys.

### 3. Monitor
Check logs for:
```
[SCHEDULER] Starting daily trend collection job
[SCHEDULER] Daily job scheduled for 3 AM
```

## API Endpoints

### Manual Collection (Testing)
```bash
# Trigger collection immediately
curl -X POST https://api-production-768d.up.railway.app/admin/collect-trends

# Response:
{
  "ok": true,
  "results": {
    "total": 150,
    "byPlatform": {
      "tiktok": 20,
      "instagram": 20,
      "youtube": 30,
      "twitter": 30,
      "news": 20,
      "wiki": 15,
      "fandom": 15
    }
  },
  "message": "Trend collection complete"
}
```

### Cleanup Old Data
```bash
# Delete metrics older than 30 days
curl -X POST https://api-production-768d.up.railway.app/admin/cleanup-metrics \
  -H "Content-Type: application/json" \
  -d '{"daysToKeep": 30}'

# Response:
{
  "ok": true,
  "deleted": 1234,
  "message": "Deleted 1234 old metrics"
}
```

### Check Status
```bash
# Get metrics summary
curl https://api-production-768d.up.railway.app/admin/metrics-summary

# Response:
{
  "ok": true,
  "summary": {
    "total": 1500,
    "byPlatform": {
      "tiktok": 250,
      "instagram": 300,
      "youtube": 400,
      "twitter": 300,
      "news": 100,
      "wiki": 75,
      "fandom": 75
    },
    "lastUpdate": "2025-01-15T03:00:00.000Z"
  }
}
```

## Testing Locally

### 1. Set Up Environment
```bash
cd backend/services/api
cp .env.example .env
# Add APIFY_API_TOKEN to .env
```

### 2. Run Migration
```bash
npm run dev

# You should see:
# [APIFY] Running migration...
# [SCHEDULER] Starting daily trend collection job
```

### 3. Test Collection (Optional)
Set `RUN_COLLECTION_ON_STARTUP=true` in `.env` to test immediately:
```bash
npm run dev

# You'll see:
# [SCHEDULER] Running initial collection on startup...
# [APIFY] Running actor: clockworks/tiktok-hashtag-scraper...
# [APIFY] Saved 20/20 items for tiktok
# ...
```

### 4. Query Results
```bash
# Check database
psql $DATABASE_URL

SELECT platform, metric_type, COUNT(*), MAX("createdAt") as latest
FROM platform_metrics
GROUP BY platform, metric_type;
```

## Schedule

**Default:** Runs daily at 3 AM

**Cron Expression:** `0 3 * * *`

**To Change:** Edit `trend-collector.ts` line 18:
```typescript
cron.schedule('0 3 * * *', async () => {
```

## Data Retention

- **Keeps:** Last 30 days of metrics
- **Auto-Cleanup:** Runs after each daily collection
- **Manual Cleanup:** `POST /admin/cleanup-metrics`

## Storage Estimates

| Duration | Records | Size |
|----------|---------|------|
| 1 day    | ~500    | ~1 MB |
| 7 days   | ~3,500  | ~7 MB |
| 30 days  | ~15,000 | ~30 MB |

## Actor Configuration

Each actor has pre-configured search terms/inputs:

| Platform | Actor ID | Input |
|----------|----------|-------|
| TikTok | clockworks/tiktok-hashtag-scraper | hashtags: viral, fyp, trending, dance, ai, fashion |
| Instagram | apify/instagram-hashtag-scraper | hashtags: viral, trending, reels, fashion, ai |
| Twitter | apidojo/tweet-scraper | searchTerms: #viral, #trending, #ai, #tech |
| YouTube | streamers/youtube-scraper | keywords: viral, trending, popular, ai, tutorial |
| News | lhotanova/google-news-scraper | queries: viral trends, social media trends |
| Wikipedia | jupri/wiki-scraper | List_of_Internet_phenomena |
| Fandom | kuaima/Fandom | wikis: tiktok, youtube, memes |

**To customize:** Edit `apify.ts` ACTORS array (lines 17-130)

## Troubleshooting

### Collection Not Running
1. Check `ENABLE_TREND_COLLECTION=true`
2. Check API logs for scheduler startup
3. Verify Apify API token is valid

### No Data After Collection
1. Check logs for actor errors
2. Verify actors are running successfully on Apify dashboard
3. Check database connection

### High API Costs
1. Reduce `maxResults` / `resultsPerHashtag` in actor configs
2. Disable specific actors you don't need
3. Increase cron schedule interval (e.g., every 2 days)

## Cost Monitoring

**Apify Free Tier:** $5/month credit

**Estimated Usage:**
- ~500 results/day × 7 actors = 3,500 results/day
- At $0.25 per 1K results = ~$0.88/day = ~$26/month

**To Reduce Costs:**
1. Lower `maxResults` per actor
2. Run less frequently (every 2-3 days)
3. Disable expensive actors (YouTube, Twitter)
4. Use Apify free datasets when available

## Integration with RAG

The collected metrics are automatically available to the retrieval service:

```typescript
// In retrieval.ts - retrieveLiveMetrics()
const metrics = await repo
  .createQueryBuilder('metric')
  .where('metric.createdAt > :cutoff', { cutoff: sevenDaysAgo })
  .orderBy('metric.createdAt', 'DESC')
  .limit(limit)
  .getMany()
```

Metrics are queried when users submit prompts and included in AI context.

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Verify daily collection starts
3. ⏳ Monitor first 24 hours
4. ⏳ Check metrics after first run
5. ⏳ Adjust actor configs based on relevance
6. ⏳ Fine-tune RAG retrieval weights
