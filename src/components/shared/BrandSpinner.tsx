import React from 'react'

export default function BrandSpinner({ text }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-white/70 text-[11px]">
      <span className="relative inline-flex w-3 h-3">
        <span className="absolute inline-flex w-3 h-3 rounded-full bg-ralph-cyan opacity-75 animate-ping"></span>
        <span className="relative inline-flex w-3 h-3 rounded-full bg-ralph-pink"></span>
      </span>
      <span>{text || 'Working…'}</span>
    </div>
  )
}

