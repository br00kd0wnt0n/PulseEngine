// Simple fetch wrapper with optional API base url
const API_BASE = (import.meta as any).env?.VITE_API_BASE || ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export type StatusOverview = {
  services: { api: { ok: boolean; status: string }; ingestion?: { ok: boolean; status: string } }
  database: { sizeBytes: number | null; tables: { name: string; bytes: number }[] }
  stats: { users: number; creators: number; trends: number; assets: number }
}

export const api = {
  statusOverview: () => request<StatusOverview>('/status/overview'),
  narrative: (graph: any, focusId?: string | null) => request<{ text: string }>(
    '/ai/narrative',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graph, focusId }) }
  ),
  score: (concept: string, graph: any, opts?: { persona?: string; region?: string }) => request<any>(
    '/ai/score',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concept, graph, ...(opts||{}) }) }
  ),
  enhancements: (concept: string, graph: any, opts?: { persona?: string; region?: string }) => request<any>(
    '/ai/enhancements',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concept, graph, ...(opts||{}) }) }
  ),
  recommendations: (concept: string, graph: any, opts?: { persona?: string; region?: string; projectId?: string }) => request<any>(
    '/ai/recommendations',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concept, graph, ...(opts||{}) }) }
  ),
  search: (q: string) => request<{ trends: any[]; creators: any[]; assets: any[] }>(
    `/search?q=${encodeURIComponent(q)}`
  ),
  debrief: (concept: string, opts?: { persona?: string; region?: string; projectId?: string }) => request<any>(
    '/ai/debrief',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concept, ...(opts||{}) }) }
  ),
  opportunities: (concept: string, opts?: { persona?: string; region?: string; projectId?: string }) => request<any>(
    '/ai/opportunities',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concept, ...(opts||{}) }) }
  ),
  wildcard: (concept: string, opts?: { persona?: string; region?: string; projectId?: string; baseline?: string }) => request<{ ideas: any[]; sourcesUsed?: string[] }>(
    '/ai/wildcard',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concept, ...(opts||{}) }) }
  ),
  conceptOverview: (concept: string, opts?: { persona?: string; region?: string; debrief?: string; opportunities?: any[]; narrative?: string; enhancements?: string[]; projectId?: string }) => request<{ overview: string }>(
    '/ai/concept-overview',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concept, ...(opts||{}) }) }
  ),
  conceptProposal: (concept: string, narrativeBlocks: { key: string; content: string }[], recommendedCreators: any[], opts?: { persona?: string; projectId?: string }) => request<any>(
    '/ai/concept-proposal',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concept, narrativeBlocks, recommendedCreators, ...(opts||{}) }) }
  ),
  applyEnhancements: (concept: string, narrative: string, enhancements: string[], opts?: { persona?: string; region?: string; projectId?: string }) => request<{ text: string }>(
    '/ai/rewrite-narrative',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concept, narrative, enhancements, ...(opts||{}) }) }
  ),
  createProject: (payload: { concept: string; persona?: string; platforms?: string[]; areasOfInterest?: string[]; graph?: any; focusId?: string | null }) =>
    request<any>('/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  createPublicProject: (payload: any) =>
    request<any>('/public/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  preflight: () => request<any>('/status/preflight'),
  adminSeed: (opts: { dry?: boolean; withAI?: boolean }) => request<any>(
    '/admin/seed',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(import.meta as any).env?.VITE_SEED_TOKEN ? { 'x-seed-token': (import.meta as any).env.VITE_SEED_TOKEN } : {},
      },
      body: JSON.stringify(opts || {}),
    }
  ),
  trends: () => request<any[]>('/public/trends'),
  creators: () => request<any[]>('/public/creators'),
  listVersions: (projectId: string) => request<any[]>(`/projects/${projectId}/versions`),
  saveVersion: (projectId: string, payload: { summary: string; narrative?: string; scores?: any; changeSummary?: string }) =>
    request<any>(`/projects/${projectId}/versions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  getConversation: (projectId: string) => request<any[]>(`/projects/${projectId}/conversation`),
  postConversation: (projectId: string, payload: { role: 'user'|'ai'; content: string }) =>
    request<any>(`/projects/${projectId}/conversation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),

  // APIFY Admin endpoints
  collectTrends: () => request<any>('/admin/collect-trends', { method: 'POST' }),
  getCollectionStatus: () => request<any>('/admin/collect-trends/status'),
  getMetricsSummary: () => request<any>('/admin/metrics-summary'),
  cleanupMetrics: (days: number = 30) => request<any>(
    '/admin/cleanup-metrics',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days }) }
  ),
}
