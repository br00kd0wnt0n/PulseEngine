type TrendGraph = { nodes: { id: string; label: string; kind: 'trend'|'creator'|'content' }[]; links: { source: string; target: string }[] }

export async function narrativeFromTrends(graph: TrendGraph, focusId?: string | null) {
  const focus = focusId ? graph.nodes.find(n => n.id === focusId)?.label : null
  const ts = new Date().toISOString()
  const trends = graph.nodes.filter(n => n.kind === 'trend').map(n => n.label)

  const key = process.env.OPENAI_API_KEY
  const model = process.env.MODEL_NAME || 'gpt-4o-mini'

  if (!key) {
    return [
      `Snapshot (${ts})`,
      `Primary trends: ${trends.join(', ')}`,
      focus ? `Focus: ${focus}` : 'Focus: none',
      '',
      'Narrative (mock): Short-form loops amplify creator-led discovery; remixable hooks spill over into gaming edits next 2–3 weeks.'
    ].join('\n')
  }
  // Placeholder: integrate OpenAI client here.
  // Return mock until wired to reduce external dependency during dev
  return `Model(${model}) integration pending. Fallback narrative generated at ${ts}.`
}

