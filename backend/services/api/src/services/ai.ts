import crypto from 'crypto'
import { AppDataSource } from '../db/data-source'
import { AICache } from '../db/entities/AICache.js'

export type TrendGraph = { nodes: { id: string; label: string; kind: 'trend'|'creator'|'content' }[]; links: { source: string; target: string }[] }

function sha(input: any) { return crypto.createHash('sha1').update(JSON.stringify(input)).digest('hex') }

async function cacheGet<T>(key: string): Promise<T | null> {
  const repo = AppDataSource.getRepository(AICache)
  const row = await repo.findOne({ where: { key } })
  return row ? (row.value as T) : null
}
async function cacheSet<T>(key: string, value: T) {
  const repo = AppDataSource.getRepository(AICache)
  await repo.upsert({ key, value }, ['key'])
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('no-openai')
  const { OpenAI } = await import('openai')
  const client = new OpenAI({ apiKey })
  const model = process.env.MODEL_NAME || 'gpt-4o-mini'
  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are an entertainment storytelling strategist. Be concise, insight-first.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 350,
  })
  return resp.choices?.[0]?.message?.content || ''
}

export async function narrativeFromTrends(graph: TrendGraph, focusId?: string | null) {
  const focus = focusId ? graph.nodes.find(n => n.id === focusId)?.label : null
  const trends = graph.nodes.filter(n => n.kind === 'trend').map(n => n.label)
  const key = sha({ type: 'narrative', trends, focus })
  const cached = await cacheGet<string>(key)
  if (cached) return cached

  const prompt = `Given these active trends: ${trends.join(', ')}${focus ? `\nFocus on: ${focus}` : ''}.\n` +
    `Explain the narrative opportunity in 4-6 sentences: why now, which hooks, and predicted time-to-peak. Keep it direct.`
  try {
    const text = await callOpenAI(prompt)
    await cacheSet(key, text)
    return text
  } catch {
    const ts = new Date().toISOString()
    const mock = `Snapshot (${ts})\nPrimary trends: ${trends.join(', ')}\n` +
      (focus ? `Focus: ${focus}\n` : '') +
      `Narrative: Short-form loops + creator collabs generate near-term lift; remixable hooks spill over into gaming edits.`
    await cacheSet(key, mock)
    return mock
  }
}

export function scoreConceptMvp(concept: string, graph: TrendGraph) {
  const text = concept.toLowerCase()
  const trendLabels = graph.nodes.filter(n => n.kind === 'trend').map(n => n.label.toLowerCase())
  const trendHits = trendLabels.filter(t => text.includes(t))
  const keywords = ['ai','music','dance','challenge','loop','retro','gaming','edit','tutorial','short','reels','collab','remix']
  const keywordHits = keywords.filter(k => text.includes(k))
  const base = clamp(30 + trendHits.length * 15 + keywordHits.length * 8, 0, 100)
  const audiencePotential = clamp(base + (text.length > 60 ? 8 : 0), 0, 100)
  const narrativeStrength = clamp(35 + trendHits.length * 12 + keywordHits.length * 10, 0, 100)
  const collaborationOpportunity = clamp(30 + trendHits.length * 10 + (text.includes('collab') ? 15 : 0), 0, 100)
  const timeToPeakWeeks = Math.max(1, Math.round(8 - (trendHits.length * 1.5 + keywordHits.length)))
  const narrativeAdaptability = clamp(40 + keywordHits.length * 6 + (text.includes('tutorial') ? 8 : 0), 0, 100)
  const crossPlatformPotential = clamp(35 + (['tiktok','shorts','reels'].filter(p => text.includes(p)).length * 12) + trendHits.length * 5, 0, 100)
  const culturalRelevance = clamp(45 + trendHits.length * 8 + (text.includes('retro') ? 6 : 0), 0, 100)
  return {
    scores: { audiencePotential, narrativeStrength, timeToPeakWeeks, collaborationOpportunity },
    ralph: { narrativeAdaptability, crossPlatformPotential, culturalRelevance },
    hits: { trendHits, keywordHits },
  }
}

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }
