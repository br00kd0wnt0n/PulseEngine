import { useState } from 'react'

type Props = { size?: number; className?: string }

export default function LogoMark({ size = 32, className = '' }: Props) {
  const [ok, setOk] = useState(true)
  return (
    <div
      className={`relative rounded-md accent-gradient ${className}`}
      style={{ width: size, height: size }}
      aria-label="Pulse icon"
    >
      {ok && (
        <img
          src="/pulseblackicon.png"
          alt="Pulse Icon"
          width={size}
          height={size}
          className="absolute inset-0 w-full h-full object-contain"
          onError={() => setOk(false)}
          draggable={false}
        />
      )}
    </div>
  )
}
