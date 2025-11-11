import { useEffect, useRef, useState } from 'react'

export default function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [open])
  return (
    <span className="relative inline-flex items-center" ref={ref}>
      <button
        aria-label={label}
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
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
