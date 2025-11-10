import { useState, DragEvent, useRef } from 'react'
import { useUpload } from '../../context/UploadContext'

export default function UploadDropzone() {
  const { addFiles, processed } = useUpload()
  const [drag, setDrag] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setDrag(false)
    const files = Array.from(e.dataTransfer.files)
    addFiles(files)
  }

  return (
    <div>
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={() => setDrag(true)}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`border border-dashed rounded-xl p-12 md:p-14 text-center cursor-pointer transition-colors ${drag ? 'border-ralph-pink bg-charcoal-700/30' : 'border-white/10 bg-charcoal-800/50'}`}
      >
        <div className="text-white/80 text-sm">Drag & drop media, PDFs, or text files</div>
        <div className="text-white/50 text-xs mt-1">or click to browse</div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.pdf,.doc,.docx,image/*,video/*,audio/*"
          className="hidden"
          onChange={(e) => addFiles(Array.from(e.target.files || []))}
        />
      </div>

      {processed.length > 0 && (
        <div className="mt-4">
          <div className="text-sm text-white/70 mb-2">Processed Content</div>
          <div className="grid md:grid-cols-2 gap-3">
            {processed.map((p) => (
              <div key={p.id} className="panel p-3">
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-white/60">{p.tags.join(', ')}</div>
                <div className="text-xs text-white/60">Category: {p.category}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
