import { useState } from 'react'
import UploadDropzone from '../Dashboard/../Upload/UploadDropzone'

export default function FloatingUpload() {
  const [open, setOpen] = useState(false)
  return (
    <div className="fixed bottom-4 right-4 z-40">
      {!open && (
        <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-full text-xs bg-ralph-pink/80 hover:bg-ralph-pink border border-white/20 shadow-md">
          + Add Context
        </button>
      )}
      {open && (
        <div className="w-[320px] panel p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Refine with context</div>
            <button onClick={() => setOpen(false)} className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10">Close</button>
          </div>
          <div className="text-[11px] text-white/60 mb-2">Drop media, PDFs, text files or paste links. We extract tags and key text to improve trend + creator matching.</div>
          <UploadDropzone />
        </div>
      )}
    </div>
  )
}

