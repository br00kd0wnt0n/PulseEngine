export default function LoadingSpinner({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative w-16 h-16">
        <img
          src="/pulseblackicon.png"
          alt="Loading"
          className="w-full h-full object-contain animate-pulse opacity-80"
        />
      </div>
      {text && (
        <div className="mt-3 text-xs text-white/60 animate-pulse">{text}</div>
      )}
    </div>
  )
}
