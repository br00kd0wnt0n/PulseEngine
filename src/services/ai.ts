import { TrendGraph } from '../types'

export async function generateNarrative(graph: TrendGraph, focusId: string | null) {
  // Mock AI generation without external API calls
  const focus = focusId ? graph.nodes.find(n => n.id === focusId)?.label : null
  const ts = new Date().toLocaleString()
  const keyTrends = graph.nodes.filter(n => n.kind === 'trend').map(n => n.label)
  const hooks = [
    'loop-friendly beats',
    'collab-first challenges',
    'nostalgia-fueled remixes',
  ]
  return [
    `Snapshot (${ts})`,
    `Primary vectors: ${keyTrends.join(', ')}.`,
    focus ? `Focus: ${focus}.` : 'Focus: none selected.',
    '',
    'Narrative:',
    `Creators are converging on ${keyTrends[0]} while ${keyTrends[1]} sustains mid-term momentum.`,
    `Winning hooks: ${hooks.join(', ')}.`,
    'Prediction: Short-form concepts with music-driven loops show strong spillover into gaming edits next 2–3 weeks.',
  ].join('\n')
}

