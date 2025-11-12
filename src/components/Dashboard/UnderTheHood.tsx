import { useEffect, useState } from 'react'
import { useUpload } from '../../context/UploadContext'
import { readActivity } from '../../utils/activity'

export default function UnderTheHood() {
  const { processed } = useUpload()
  const count = processed.length
  const tags = Array.from(new Set(processed.flatMap(p => p.tags))).slice(0, 12)
  const cats = Array.from(new Set(processed.map(p => p.category))).slice(0, 6)
  const [activity, setActivity] = useState<{ ts: number; msg: string }[]>([])

  useEffect(() => {
    setActivity(readActivity())
    function onLog(e: any) {
      const item = { ts: e?.detail?.ts || Date.now(), msg: e?.detail?.msg || 'Activity' }
      setActivity((a) => [item, ...a].slice(0, 200))
    }
    window.addEventListener('activity-log', onLog as any)
    return () => window.removeEventListener('activity-log', onLog as any)
  }, [])
  return (
    <div className="panel module p-4">
      <div className="font-semibold mb-1">Under the Hood</div>
      <div className="text-xs text-white/60 mb-3">Live context and activity trace powering updates in real time.</div>
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <div className="panel p-3">
          <div className="text-xs text-white/60">Context Items</div>
          <div className="text-xl font-semibold">{count}</div>
        </div>
        <div className="md:col-span-2 panel p-3">
          <div className="text-xs text-white/60 mb-1">Key Tags</div>
          <div className="flex flex-wrap gap-2">
            {tags.map(t => <span key={t} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs">{t}</span>)}
          </div>
        </div>
      </div>
      {cats.length > 0 && (
        <div className="mt-3 panel p-3">
          <div className="text-xs text-white/60 mb-1">Content Types</div>
          <div className="flex flex-wrap gap-2">
            {cats.map(c => <span key={c} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs">{c}</span>)}
          </div>
        </div>
      )}
      {/* Activity log */}
      <div className="mt-3 panel p-3">
        <div className="text-xs text-white/60 mb-1">Activity</div>
        <div className="max-h-40 overflow-y-auto text-[11px] leading-5 pr-1">
          {activity.length === 0 && <div className="text-white/40">No activity yet…</div>}
          {activity.map((a, i) => (
            <div key={i} className="text-white/70">
              <span className="text-white/35 mr-2">{new Date(a.ts).toLocaleTimeString()}</span>
              {a.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
