import { TrendGraph, TrendNode, Creator } from '../types'

export type ConceptScores = {
  audiencePotential: number
  narrativeStrength: number
  timeToPeakWeeks: number
  collaborationOpportunity: number
}

export type ConceptAnalysis = {
  scores: ConceptScores
  keyDrivers: string[]
  recommendedCreators: Creator[]
  relatedTrends: TrendNode[]
}

export function scoreConcept(concept: string, graph: TrendGraph, creators: Creator[]): ConceptAnalysis {
  const text = concept.toLowerCase()
  const trendHits = graph.nodes.filter(n => n.kind === 'trend' && text.includes(n.label.toLowerCase()))
  const keywordHits = keywords.filter(k => text.includes(k))
  const base = clamp(30 + trendHits.length * 15 + keywordHits.length * 8 + randFrom(text) * 10, 0, 100)

  const audiencePotential = clamp(base + (text.length > 60 ? 8 : 0), 0, 100)
  const narrativeStrength = clamp(35 + trendHits.length * 12 + keywordHits.length * 10 + randFrom(text + 'n') * 15, 0, 100)
  const collaborationOpportunity = clamp(30 + trendHits.length * 10 + randFrom(text + 'c') * 20, 0, 100)
  const timeToPeakWeeks = Math.max(1, Math.round(8 - (trendHits.length * 1.5 + keywordHits.length)))

  const recommendedCreators = creators
    .map(c => ({ c, score: c.resonance * 0.5 + c.collaboration * 0.5 + (intersects(c.tags, keywordHits) ? 12 : 0) }))
    .sort((a,b) => b.score - a.score)
    .slice(0, 5)
    .map(x => x.c)

  const relatedTrends = (trendHits.length ? trendHits : graph.nodes.filter(n => n.kind === 'trend').slice(0, 3))

  return {
    scores: { audiencePotential, narrativeStrength, timeToPeakWeeks, collaborationOpportunity },
    keyDrivers: [...trendHits.map(t => t.label), ...keywordHits].slice(0, 5),
    recommendedCreators,
    relatedTrends,
  }
}

export function potentialColor(value: number) {
  // 0-40 cyan, 40-70 purple, 70-100 pink
  if (value >= 70) return '#EB008B'
  if (value >= 40) return '#8a63ff'
  return '#3be8ff'
}

const keywords = [
  'ai', 'music', 'dance', 'challenge', 'loop', 'retro', 'gaming', 'edit', 'tutorial', 'short', 'long-form', 'collab', 'remix'
]

function randFrom(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  const x = Math.sin(h) * 10000
  return x - Math.floor(x)
}

function intersects(a: string[], b: string[]) {
  const set = new Set(a.map(x => x.toLowerCase()))
  return b.some(x => set.has(x.toLowerCase()))
}

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }

