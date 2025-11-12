import { useUpload } from '../../context/UploadContext'

export default function UnderTheHood() {
  const { processed } = useUpload()
  const count = processed.length
  const tags = Array.from(new Set(processed.flatMap(p => p.tags))).slice(0, 12)
  const cats = Array.from(new Set(processed.map(p => p.category))).slice(0, 6)
  return (
    <div className="panel module p-4">
      <div className="font-semibold mb-1">Under the Hood</div>
      <div className="text-xs text-white/60 mb-3">A live view of the context driving this story — extracted tags and content we’re using to refine recommendations.</div>
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
    </div>
  )
}

