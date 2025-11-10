export default function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-white/70">
      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-ralph-pink inline-block"/> Trend</div>
      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-ralph-purple inline-block"/> Creator</div>
      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-ralph-cyan inline-block"/> Content</div>
      <div className="flex items-center gap-2"><span className="h-2 w-6 bg-white/30 inline-block"/> Connection</div>
    </div>
  )
}

