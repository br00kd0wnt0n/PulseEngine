type ActivityItem = { ts: number; msg: string }

const KEY = 'activity-log'
const MAX_ITEMS = 200

export function logActivity(msg: string) {
  try {
    const item: ActivityItem = { ts: Date.now(), msg }
    const raw = localStorage.getItem(KEY)
    const list: ActivityItem[] = raw ? JSON.parse(raw) : []
    const next = [item, ...list].slice(0, MAX_ITEMS)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
  try { window.dispatchEvent(new CustomEvent('activity-log', { detail: { msg, ts: Date.now() } })) } catch {}
}

export function readActivity(): ActivityItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function clearActivity() {
  try { localStorage.removeItem(KEY) } catch {}
}

