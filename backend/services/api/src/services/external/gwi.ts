import { AppDataSource } from '../../db/data-source.js'
import { PlatformMetric } from '../../db/entities/PlatformMetric.js'

const GWI_API_URL = 'https://api.globalwebindex.com/v1/spark-api/mcp'

// Simple rate limiter: 1 request per second
let lastRequestTime = 0
async function rateLimit() {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - elapsed))
  }
  lastRequestTime = Date.now()
}

// Session map: projectId → GWI chat_id for follow-up queries
const sessionMap = new Map<string, string>()

interface GWIQueryOpts {
  concept: string
  targetAudience?: string
  nodeType: string
  nodeContext?: string
  region?: string
  persona?: string
  projectId?: string
}

interface GWIInsight {
  metric: string
  value: string
  source?: string
}

interface GWIResult {
  message: string
  insights: GWIInsight[]
  sources: string[]
  chatId?: string
  itemsSaved: number
}

/**
 * Build a natural language prompt for GWI based on concept and node type
 */
function buildGWIPrompt(opts: GWIQueryOpts): string {
  const { concept, targetAudience, nodeType, nodeContext, region } = opts

  const audienceClause = targetAudience ? ` among ${targetAudience}` : ''
  const regionClause = region ? ` in ${region}` : ''

  const templates: Record<string, string> = {
    debrief: `What are the audience behaviors and media consumption habits${audienceClause}${regionClause} related to "${concept}"? Include demographic breakdowns, platform preferences, and content engagement patterns.`,
    scoring: `Provide quantified audience metrics${audienceClause}${regionClause} for "${concept}". Include reach percentages, affinity indices, and engagement benchmarks.`,
    narrative: `What audience insights${audienceClause}${regionClause} should inform the storytelling approach for "${concept}"? Focus on emotional drivers, content preferences, and cultural context.`,
    opportunities: `What untapped audience segments and growth opportunities exist${audienceClause}${regionClause} for "${concept}"? Include emerging behaviors and underserved audiences.`,
    'concept-overview': `Provide a comprehensive audience intelligence overview${audienceClause}${regionClause} for "${concept}". Cover demographics, psychographics, media habits, and brand affinities.`,
  }

  let prompt = templates[nodeType] || `What audience insights${audienceClause}${regionClause} are relevant to "${concept}"?`

  if (nodeContext) {
    prompt += `\n\nAdditional context: ${nodeContext.substring(0, 500)}`
  }

  return prompt
}

/**
 * Call GWI Spark API (JSON-RPC 2.0)
 */
async function queryGWI(prompt: string, chatId?: string): Promise<{ message: string; insights: GWIInsight[]; sources: string[]; chatId?: string }> {
  const token = process.env.GWI_API_TOKEN
  if (!token) throw new Error('GWI_API_TOKEN not configured')

  await rateLimit()

  const payload: any = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: 'chat_gwi',
      arguments: { message: prompt }
    }
  }

  if (chatId) {
    payload.params.arguments.chat_id = chatId
  }

  console.log('[GWI] Querying Spark API...')
  const res = await fetch(GWI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-gwi-api-key': token,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GWI API returned ${res.status}: ${text.substring(0, 200)}`)
  }

  const rpcResponse = await res.json()

  // Handle JSON-RPC error
  if (rpcResponse.error) {
    throw new Error(`GWI API error: ${rpcResponse.error.message || JSON.stringify(rpcResponse.error)}`)
  }

  // Parse double-wrapped response: JSON-RPC envelope → result.content[0].text → inner JSON
  const content = rpcResponse.result?.content?.[0]?.text
  if (!content) {
    console.warn('[GWI] Empty response content')
    return { message: 'No insights returned', insights: [], sources: [] }
  }

  let parsed: any
  try {
    parsed = JSON.parse(content)
  } catch {
    // If not JSON, treat the text as the message itself
    parsed = { message: content }
  }

  const message = parsed.message || parsed.answer || parsed.response || content
  const responseChatId = parsed.chat_id || rpcResponse.result?.chat_id

  // Extract structured insights if available
  const insights: GWIInsight[] = []
  if (Array.isArray(parsed.insights)) {
    for (const ins of parsed.insights) {
      insights.push({
        metric: ins.metric || ins.label || ins.title || 'Insight',
        value: ins.value || ins.description || ins.text || JSON.stringify(ins),
        source: ins.source || ins.topic,
      })
    }
  } else if (Array.isArray(parsed.data)) {
    for (const d of parsed.data) {
      insights.push({
        metric: d.metric || d.label || d.name || 'Data Point',
        value: d.value || d.description || JSON.stringify(d),
        source: d.source,
      })
    }
  }

  // Extract source topics
  const sources: string[] = parsed.sources || parsed.topics || []

  console.log(`[GWI] Response received: ${message.substring(0, 100)}... (${insights.length} insights)`)

  return { message, insights, sources, chatId: responseChatId }
}

/**
 * Store GWI insights into platform_metrics
 */
async function storeGWIInsights(result: { message: string; insights: GWIInsight[]; sources: string[] }, opts: GWIQueryOpts): Promise<number> {
  const repo = AppDataSource.getRepository(PlatformMetric)
  let saved = 0

  // Store the overall message as one record
  try {
    const metric = repo.create({
      platform: 'gwi',
      metric_type: `audience_insight_${opts.nodeType}`,
      engagement: 0,
      velocity: 0,
      value: {
        message: result.message,
        concept: opts.concept,
        nodeType: opts.nodeType,
        targetAudience: opts.targetAudience,
        region: opts.region,
        insightCount: result.insights.length,
      },
      metadata: {
        sources: result.sources,
        projectId: opts.projectId,
        queriedAt: new Date().toISOString(),
      },
    })
    await repo.save(metric)
    saved++
  } catch (err) {
    console.error('[GWI] Failed to save summary metric:', err)
  }

  // Store individual insights as separate records for granular RAG retrieval
  for (const insight of result.insights) {
    try {
      const metric = repo.create({
        platform: 'gwi',
        metric_type: 'audience_data_point',
        engagement: 0,
        velocity: 0,
        value: {
          metric: insight.metric,
          description: insight.value,
          concept: opts.concept,
          nodeType: opts.nodeType,
        },
        metadata: {
          source: insight.source,
          projectId: opts.projectId,
        },
      })
      await repo.save(metric)
      saved++
    } catch (err) {
      console.error('[GWI] Failed to save insight metric:', err)
    }
  }

  console.log(`[GWI] Saved ${saved} records to platform_metrics`)
  return saved
}

/**
 * Main entry point: fetch GWI audience insights
 * Orchestrates rate limit → query → session management → storage
 */
export async function fetchGWIInsights(opts: GWIQueryOpts): Promise<GWIResult> {
  const prompt = buildGWIPrompt(opts)

  // Look up existing chat session for follow-up context
  const sessionKey = opts.projectId || 'default'
  const existingChatId = sessionMap.get(sessionKey)

  const result = await queryGWI(prompt, existingChatId)

  // Store chat_id for follow-up queries
  if (result.chatId) {
    sessionMap.set(sessionKey, result.chatId)
  }

  // Persist to database
  const itemsSaved = await storeGWIInsights(result, opts)

  return {
    message: result.message,
    insights: result.insights,
    sources: result.sources,
    chatId: result.chatId,
    itemsSaved,
  }
}

/**
 * Check if GWI API is configured
 */
export function isGWIConfigured(): boolean {
  return !!process.env.GWI_API_TOKEN
}
