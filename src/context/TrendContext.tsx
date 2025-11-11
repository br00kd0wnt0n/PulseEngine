import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { TrendGraph, TrendNode } from '../types'
import { mockGraph, computeMetrics } from '../services/trends'
import { api } from '../services/api'

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
  const [graph, setGraph] = useState<TrendGraph>(() => mockGraph())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Try to hydrate from API (trends + creators), fallback to mock
  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const [trends, creators] = await Promise.all([api.trends().catch(() => []), api.creators().catch(() => [])])
        if (cancel) return
        if (Array.isArray(trends) && trends.length) {
          const nodes: TrendNode[] = []
          const links: { source: string; target: string }[] = []
          const tnodes = trends.map((t: any) => ({ id: t.id || t.label, label: t.label, kind: 'trend' as const }))
          nodes.push(...tnodes)
          const cnodes = creators.map((c: any) => ({ id: c.id || c.name, label: c.name, kind: 'creator' as const }))
          nodes.push(...cnodes)
          // Link creators to trends if tags intersect
          creators.forEach((c: any) => {
            const ctags: string[] = (c.metadata?.tags || c.tags || []).map((x: any) => String(x).toLowerCase())
            trends.forEach((t: any) => {
              const ttags: string[] = (t.metrics?.tags || []).map((x: any) => String(x).toLowerCase())
              if (ctags.length && ttags.length && ctags.some((x) => ttags.includes(x))) {
                links.push({ source: t.id || t.label, target: c.id || c.name })
              }
            })
          })
          setGraph({ nodes, links })
        }
      } catch {
        // ignore, stay on mock graph
      }
    })()
    return () => { cancel = true }
  }, [])

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
