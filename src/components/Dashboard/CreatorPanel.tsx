import { useCreators } from '../../context/CreatorContext'

export default function CreatorPanel() {
  const { recommended } = useCreators()
  return (
    <div className="panel module p-4 transform-gpu">
      <div className="font-semibold mb-3">Creator Intelligence</div>
      <div className="grid lg:grid-cols-1 md:grid-cols-2 gap-3">
        {recommended.map(c => (
          <div key={c.id} className="flex items-center gap-3 p-3 rounded border border-white/10 bg-charcoal-800/50">
            <div className="h-9 w-9 rounded-full bg-ralph-purple/30 border border-white/10" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{c.name}</div>
              <div className="text-xs text-white/60 truncate">{c.platform} • {c.category}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/50">Res</div>
              <div className="font-semibold text-sm">{Math.round(c.resonance)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/50">Collab</div>
              <div className="font-semibold text-sm">{Math.round(c.collaboration)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
