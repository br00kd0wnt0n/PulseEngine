// Simple fetch wrapper with optional API base url
const API_BASE = (import.meta as any).env?.VITE_API_BASE || ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export type StatusOverview = {
  services: { api: { ok: boolean; status: string } }
  database: { sizeBytes: number | null; tables: { name: string; bytes: number }[] }
  stats: { users: number; creators: number; trends: number; assets: number }
}

export const api = {
  statusOverview: () => request<StatusOverview>('/status/overview'),
}
