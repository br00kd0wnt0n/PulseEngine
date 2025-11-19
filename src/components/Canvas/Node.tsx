import { useState, useRef, useEffect } from 'react'

export type NodeData = {
  id: string
  type: string
  title: string
  x: number
  y: number
  width: number
  height: number
  minimized: boolean
  zIndex: number
  status?: 'idle' | 'active' | 'complete' | 'processing'
  connectedTo?: string[]
}

type NodeProps = {
  data: NodeData
  onUpdate: (id: string, updates: Partial<NodeData>) => void
  onFocus: (id: string) => void
  children: React.ReactNode
}

export default function Node({ data, onUpdate, onFocus, children }: NodeProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const nodeRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.node-content')) return // Don't drag when clicking content
    e.preventDefault() // Prevent text selection during drag
    setIsDragging(true)
    onFocus(data.id)
    // Calculate offset from current node position to mouse position
    setDragOffset({
      x: e.clientX - data.x,
      y: e.clientY - data.y
    })
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      onUpdate(data.id, { x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, data.id, onUpdate])

  const toggleMinimize = () => {
    onUpdate(data.id, { minimized: !data.minimized })
  }

  // Type-based colors
  const getNodeColor = () => {
    // RKB only - orange
    if (data.type === 'rkb') {
      return 'border-orange-400/40 bg-orange-400/10'
    }
    // AI-generated content - pink (debrief, opportunities, etc.)
    if (data.type === 'ai-content' || data.type === 'debrief') {
      return 'border-ralph-pink/40 bg-ralph-pink/10'
    }
    // User input - blue
    if (data.type === 'user-input' || data.type === 'input' || data.type === 'upload') {
      return 'border-ralph-cyan/40 bg-ralph-cyan/10'
    }
    // Default
    return 'border-white/20 bg-charcoal-800/90'
  }

  const nodeColor = getNodeColor()
  const activeGlow = data.status === 'active' ? ' ring-2 ring-ralph-cyan/50 shadow-xl shadow-ralph-cyan/40' : ''

  return (
    <div
      ref={nodeRef}
      className={`absolute rounded-lg border-2 backdrop-blur-sm transition-all ${nodeColor}${activeGlow}`}
      style={{
        left: data.x,
        top: data.y,
        width: data.minimized ? 240 : data.width,
        height: data.minimized ? 48 : data.height,
        zIndex: data.zIndex,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            data.status === 'active' ? 'bg-ralph-cyan' :
            data.status === 'complete' ? 'bg-ralph-pink' :
            data.status === 'processing' ? 'bg-orange-400 animate-pulse' :
            'bg-white/40'
          }`} />
          <div className="text-sm font-medium">{data.title}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleMinimize}
            className="px-2 py-0.5 text-xs hover:bg-white/10 rounded transition-colors"
          >
            {data.minimized ? '□' : '_'}
          </button>
        </div>
      </div>

      {/* Content */}
      {!data.minimized && (
        <div className="node-content p-3 overflow-auto" style={{ height: data.height - 48 }}>
          {children}
        </div>
      )}
    </div>
  )
}
