import crypto from 'crypto'
import { AppDataSource } from '../db/data-source.js'
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
  await repo.upsert({ key, value: value as any }, ['key'])
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

// Generate recommendations by category; uses OpenAI if available, else heuristic
export async function generateRecommendations(concept: string, graph: TrendGraph) {
  const apiKey = process.env.OPENAI_API_KEY
  if (apiKey) {
    try {
      const { OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey })
      const model = process.env.MODEL_NAME || 'gpt-4o-mini'
      const prompt = `You are a storytelling strategist. Given this story concept: "${concept}"\n` +
        `Provide 4 categories of recommendations with 3 concise bullets each:\n` +
        `- Narrative Development\n- Content Strategy\n- Platform Coverage\n- Collaboration\n` +
        `Return strictly as JSON with keys narrative, content, platform, collab and array of strings.`
      const resp = await client.chat.completions.create({
        model,
        messages: [ { role: 'system', content: 'Return only JSON.' }, { role: 'user', content: prompt } ],
        temperature: 0.7,
        max_tokens: 350,
      })
      const raw = resp.choices?.[0]?.message?.content || '{}'
      try { return JSON.parse(raw) } catch { /* fallthrough */ }
    } catch { /* fallthrough */ }
  }
  return buildHeuristicRecs(concept)
}

function buildHeuristicRecs(concept?: string) {
  const lc = (concept || '').toLowerCase()
  const flags = {
    dance: lc.includes('dance'), ai: lc.includes('ai'), retro: lc.includes('retro'), tutorial: lc.includes('tutorial')
  }
  const narrative = [
    flags.ai ? 'Lean into AI hook; make the benefit explicit in sentence one.' : 'Clarify the core hook in sentence one.',
    flags.retro ? 'Tie nostalgia to a modern pattern with a named device.' : 'Add a cultural beat that resonates with target audience.',
    'Close with a prompt that invites creator response (duet/stitch).',
  ]
  const content = [
    flags.tutorial ? 'Produce a 20–30s how‑to variant to boost saves.' : 'Plan a tutorial cut to improve saves and replays.',
    flags.dance ? 'Design a loop‑friendly beat for the dance moment (7–10s).' : 'Identify a loopable moment to support replays.',
    'Prepare 3–5 caption variants to test hook clarity.',
  ]
  const platform = [
    'Ship trims for TikTok/Shorts/Reels; tailor the first 2s to each.',
    flags.retro ? 'Use overlays to connect nostalgia with present relevance.' : 'Use overlays to state the promise in frame 1.',
    'Schedule posts to match your audience’s peak windows.',
  ]
  const collab = [
    flags.dance ? 'Target dance creators with a duet prompt and a clear beat.' : 'Invite creator remixes with a simple prompt and stitch cue.',
    'Line up 1 macro + 3 micro collaborators for coverage.',
    'Offer a shared asset (beat/overlay) to ease adoption.',
  ]
  return { narrative, content, platform, collab }
}
