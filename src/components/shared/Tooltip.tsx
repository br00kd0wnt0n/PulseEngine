import { useState } from 'react'

export default function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex items-center">
      <button
        aria-label={label}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] bg-white/10 border border-white/20"
      >
        ?
      </button>
      {open && (
        <span className="absolute z-50 top-5 right-0 w-56 p-2 rounded-md text-[11px] bg-charcoal-800 border border-white/10 shadow-md">
          {children}
        </span>
      )}
    </span>
  )
}

