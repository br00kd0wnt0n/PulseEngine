import { createContext, useContext, useMemo, useState } from 'react'
import { TrendGraph, TrendNode } from '../types'
import { mockGraph, computeMetrics } from '../services/trends'

type Ctx = {
  nodes: TrendNode[]
  links: { source: string; target: string }[]
  selected: TrendNode | null
  selectNode: (id: string | null) => void
  metricsFor: (id: string) => ReturnType<typeof computeMetrics>
  snapshot: () => TrendGraph
}

const TrendCtx = createContext<Ctx | null>(null)

export function TrendProvider({ children }: { children: React.ReactNode }) {
  const [graph] = useState<TrendGraph>(() => mockGraph())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const nodes = graph.nodes
  const links = graph.links
  const selected = nodes.find(n => n.id === selectedId) || null

  const metricsCache = useMemo(() => new Map<string, ReturnType<typeof computeMetrics>>(), [])
  const metricsFor = (id: string) => {
    if (!metricsCache.has(id)) metricsCache.set(id, computeMetrics(graph, id))
    return metricsCache.get(id)!
  }

  const value: Ctx = {
    nodes, links, selected,
    selectNode: (id) => setSelectedId(id),
    metricsFor,
    snapshot: () => graph,
  }

  return <TrendCtx.Provider value={value}>{children}</TrendCtx.Provider>
}

export const useTrends = () => {
  const v = useContext(TrendCtx)
  if (!v) throw new Error('TrendContext missing')
  return v
}

