import { useState, DragEvent, useRef } from 'react'
import { useUpload } from '../../context/UploadContext'

export default function UploadDropzone() {
  const { addFiles, processed } = useUpload()
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return

    setError(null)
    setUploading(true)
    try {
      await addFiles(files)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setDrag(false)
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  return (
    <div>
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragEnter={() => !uploading && setDrag(true)}
        onDragOver={(e) => { e.preventDefault(); if (!uploading) setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`border border-dashed rounded-xl p-12 md:p-14 text-center transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${drag ? 'border-ralph-pink bg-charcoal-700/30' : 'border-white/10 bg-charcoal-800/50'}`}
      >
        {uploading ? (
          <>
            <div className="text-white/80 text-sm">Uploading files...</div>
            <div className="text-white/50 text-xs mt-1">Please wait</div>
          </>
        ) : (
          <>
            <div className="text-white/80 text-sm">Drag & drop media, PDFs, or text files</div>
            <div className="text-white/50 text-xs mt-1">or click to browse</div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.pdf,.doc,.docx,image/*,video/*,audio/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) => handleFiles(Array.from(e.target.files || []))}
        />
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="text-sm text-red-400">Upload failed: {error}</div>
        </div>
      )}

      {processed.length > 0 && (
        <div className="mt-4">
          <div className="text-sm text-white/70 mb-2">Processed Content ({processed.length})</div>
          <div className="grid md:grid-cols-2 gap-3">
            {processed.map((p) => (
              <div key={p.id} className="panel p-3">
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-white/60">{p.tags.join(', ')}</div>
                <div className="text-xs text-white/60">Category: {p.category}</div>
                {p.summary && <div className="text-xs text-white/50 mt-1">{p.summary}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
