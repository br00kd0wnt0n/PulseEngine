import { useEffect, useState } from 'react'
import { readActivity } from '../../utils/activity'

export default function ActivityPanel() {
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
    <div className="panel p-3">
      <div className="text-xs text-white/60 mb-1">Activity</div>
      <div className="max-h-72 overflow-y-auto text-[11px] leading-5 pr-1">
        {activity.length === 0 && <div className="text-white/40">No activity yet…</div>}
        {activity.map((a, i) => (
          <div key={i} className="text-white/70">
            <span className="text-white/35 mr-2">{new Date(a.ts).toLocaleTimeString()}</span>
            {a.msg}
          </div>
        ))}
      </div>
    </div>
  )
}

