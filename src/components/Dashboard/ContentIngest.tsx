import UploadDropzone from '../Upload/UploadDropzone'
import { useUpload } from '../../context/UploadContext'

export default function ContentIngest() {
  const { processed } = useUpload()
  return (
    <div className="panel module p-4 transform-gpu">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Content Upload & Processing</div>
        <div className="text-xs text-white/60">{processed.length} item{processed.length === 1 ? '' : 's'} processed</div>
      </div>
      <div className="text-xs text-white/60 mb-3">We extract tags and context from your files to enhance trend matching and creator alignment.</div>
      <UploadDropzone />
      {processed.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-white/60 mb-2">Before → After</div>
          <div className="grid md:grid-cols-2 gap-3">
            {processed.slice(0,4).map((p) => (
              <div key={p.id} className="panel p-3">
                <div className="text-xs text-white/60">File</div>
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-white/60 mt-2">Extracted</div>
                <div className="text-xs">Tags: {p.tags.join(', ')}</div>
                <div className="text-xs">Category: {p.category}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
