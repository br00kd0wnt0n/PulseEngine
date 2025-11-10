import { Creator } from '../../types'

export default function CreatorCard({ c }: { c: Creator }) {
  return (
    <div className="panel p-4 flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-ralph-purple/30 border border-white/10" />
      <div className="flex-1">
        <div className="font-medium">{c.name}</div>
        <div className="text-xs text-white/60">{c.category} • {c.platform}</div>
      </div>
      <div className="text-right">
        <div className="text-xs text-white/60">Resonance</div>
        <div className="font-semibold">{Math.round(c.resonance)}</div>
      </div>
      <div className="text-right">
        <div className="text-xs text-white/60">Collab</div>
        <div className="font-semibold">{Math.round(c.collaboration)}</div>
      </div>
    </div>
  )
}

