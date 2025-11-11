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
  score: (concept: string, graph: any) => request<any>(
    '/ai/score',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ concept, graph }) }
  ),
  createProject: (payload: { concept: string; persona?: string; platforms?: string[]; areasOfInterest?: string[]; graph?: any; focusId?: string | null }) =>
    request<any>('/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
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
}
