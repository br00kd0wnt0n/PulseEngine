import { TrendGraph } from '../types'

export function mockGraph(): TrendGraph {
  const nodes = [
    { id: 't1', label: 'AI Music', kind: 'trend' as const },
    { id: 't2', label: 'Dance Challenge', kind: 'trend' as const },
    { id: 't3', label: 'Retro Gaming', kind: 'trend' as const },
    { id: 'cr1', label: 'Nova Quinn', kind: 'creator' as const },
    { id: 'cr2', label: 'Luna Voss', kind: 'creator' as const },
    { id: 'ct1', label: 'Short Loop', kind: 'content' as const },
    { id: 'ct2', label: 'Tutorial', kind: 'content' as const },
  ]
  const links = [
    { source: 't1', target: 'cr1' },
    { source: 't2', target: 'cr2' },
    { source: 't2', target: 'ct1' },
    { source: 't1', target: 'ct2' },
    { source: 't3', target: 'cr1' },
    { source: 't3', target: 'ct1' },
  ]
  return { nodes, links }
}

export function computeMetrics(graph: TrendGraph, id: string) {
  const deg = graph.links.filter(l => l.source === id || l.target === id).length
  const base = 50 + deg * 10
  return {
    potential: base + Math.random() * 20,
    longevity: 40 + (deg > 1 ? 20 : 0) + Math.random() * 20,
    resonance: 45 + deg * 8 + Math.random() * 15,
    velocity: 35 + Math.random() * 30,
  }
}

