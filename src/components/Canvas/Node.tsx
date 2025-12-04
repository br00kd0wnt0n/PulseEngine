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
  onAddNode?: () => void // Callback for adding duplicate nodes (e.g., Course Correct)
}

type NodeProps = {
  data: NodeData
  onUpdate: (id: string, updates: Partial<NodeData>) => void
  onFocus: (id: string) => void
  onStartLink?: (id: string) => void
  scale?: number
  getCanvasBounds?: () => DOMRect | null
  children: React.ReactNode
}

export default function Node({ data, onUpdate, onFocus, onStartLink, scale = 1, getCanvasBounds, children }: NodeProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, mouseX: 0, mouseY: 0 })
  const nodeRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.node-content')) return // Don't drag when clicking content
    if ((e.target as HTMLElement).closest('.resize-handle')) return // Don't drag when resizing
    e.preventDefault() // Prevent text selection during drag
    setIsDragging(true)
    onFocus(data.id)
    // Calculate offset from current node position to mouse position
    const rect = getCanvasBounds?.() || { left: 0, top: 0 } as any
    const cx = (e.clientX - (rect.left || 0)) / scale
    const cy = (e.clientY - (rect.top || 0)) / scale
    setDragOffset({ x: cx - data.x, y: cy - data.y })
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent drag from triggering
    e.preventDefault()
    setIsResizing(true)
    onFocus(data.id)
    const rect = getCanvasBounds?.() || { left: 0, top: 0 } as any
    const cx = (e.clientX - (rect.left || 0)) / scale
    const cy = (e.clientY - (rect.top || 0)) / scale
    setResizeStart({ width: data.width, height: data.height, mouseX: cx, mouseY: cy })
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = getCanvasBounds?.() || { left: 0, top: 0 } as any
      const cx = (e.clientX - (rect.left || 0)) / scale
      const cy = (e.clientY - (rect.top || 0)) / scale
      const newX = cx - dragOffset.x
      const newY = cy - dragOffset.y
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

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = getCanvasBounds?.() || { left: 0, top: 0 } as any
      const cx = (e.clientX - (rect.left || 0)) / scale
      const cy = (e.clientY - (rect.top || 0)) / scale
      const deltaX = cx - resizeStart.mouseX
      const deltaY = cy - resizeStart.mouseY
      const newWidth = Math.max(300, resizeStart.width + deltaX) // Min width 300px
      const newHeight = Math.max(200, resizeStart.height + deltaY) // Min height 200px
      onUpdate(data.id, { width: newWidth, height: newHeight })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, resizeStart, data.id, onUpdate])

  const toggleMinimize = () => {
    onUpdate(data.id, { minimized: !data.minimized })
  }

  // Type-based colors (brand-consistent accents)
  const getNodeColor = () => {
    // Wildcard: standout yellow accent
    if (data.type === 'wildcard') {
      return 'border-yellow-400/60 bg-yellow-400/20'
    }
    // Integrations (inactive): subtle greyed
    if (data.type === 'integration') {
      return 'border-dashed border-white/20 bg-white/5 opacity-60'
    }
    // RKB only - orange
    if (data.type === 'rkb') {
      return 'border-orange-400/40 bg-orange-400/10'
    }
    // Course Correct - distinct floating style with gradient border effect
    if (data.type === 'course-correct') {
      return 'border-purple-400/50 bg-gradient-to-br from-purple-900/30 to-indigo-900/30'
    }
    // AI-generated content - pink (debrief, opportunities, etc.)
    if (data.type === 'ai-content' || data.type === 'debrief') {
      return 'border-ralph-pink/40 bg-ralph-pink/10'
    }
    // User input - cyan
    if (data.type === 'user-input' || data.type === 'input' || data.type === 'upload') {
      return 'border-ralph-cyan/40 bg-ralph-cyan/10'
    }
    // Default
    return 'border-white/20 bg-charcoal-800/90'
  }

  // Type-based hover glow that matches node color
  const getHoverGlow = () => {
    if (data.type === 'wildcard') {
      return 'hover:ring-2 hover:ring-yellow-400/50 hover:shadow-xl hover:shadow-yellow-400/40'
    }
    if (data.type === 'integration') {
      return 'hover:ring-2 hover:ring-white/20 hover:shadow-xl hover:shadow-white/10'
    }
    if (data.type === 'rkb') {
      return 'hover:ring-2 hover:ring-orange-400/50 hover:shadow-xl hover:shadow-orange-400/40'
    }
    if (data.type === 'course-correct') {
      return 'hover:ring-2 hover:ring-purple-400/50 hover:shadow-xl hover:shadow-purple-400/40'
    }
    if (data.type === 'ai-content' || data.type === 'debrief') {
      return 'hover:ring-2 hover:ring-ralph-pink/50 hover:shadow-xl hover:shadow-ralph-pink/40'
    }
    if (data.type === 'user-input' || data.type === 'input' || data.type === 'upload') {
      return 'hover:ring-2 hover:ring-ralph-cyan/50 hover:shadow-xl hover:shadow-ralph-cyan/40'
    }
    return 'hover:ring-2 hover:ring-white/30 hover:shadow-xl hover:shadow-white/20'
  }

  const nodeColor = getNodeColor()
  const hoverGlow = getHoverGlow()

  return (
    <div
      ref={nodeRef}
      className={`absolute rounded-lg border-2 backdrop-blur-sm transition-all duration-300 ease-out transform-gpu ${nodeColor} ${hoverGlow}`}
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
            (data.status === 'active' && data.type === 'wildcard') ? 'bg-yellow-400' :
            (data.status === 'active' && data.type === 'course-correct') ? 'bg-purple-400' :
            data.status === 'active' ? 'bg-ralph-cyan' :
            data.status === 'complete' ? 'bg-ralph-pink' :
            data.status === 'processing' ? 'bg-ralph-pink animate-pulse' :
            'bg-white/40'
          }`} />
          <div className="text-sm font-medium">{data.title}</div>
        </div>
        <div className="flex items-center gap-1">
          {/* Add button for course-correct type nodes */}
          {data.type === 'course-correct' && data.onAddNode && (
            <button
              onClick={(e) => { e.stopPropagation(); data.onAddNode?.() }}
              className="px-2 py-0.5 text-xs hover:bg-white/10 rounded transition-colors text-purple-300"
              title="Add another Course Correct"
            >
              +
            </button>
          )}
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
        <>
          <div className="node-content p-3 overflow-auto" style={{ height: data.height - 48 }}>
            {children}
          </div>
          {/* Resize handle */}
          <div
            className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-50 hover:opacity-100 transition-opacity"
            onMouseDown={handleResizeMouseDown}
            style={{
              background: 'linear-gradient(135deg, transparent 0%, transparent 50%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.5) 100%)'
            }}
            title="Drag to resize"
          />
        </>
      )}

      {/* Connection handle (for integrations) */}
      {data.type === 'integration' && (
        <div
          className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white/20 border border-white/30 hover:bg-white/40 cursor-crosshair transition-colors"
          title="Drag to connect"
          onMouseDown={(e) => {
            e.stopPropagation()
            if (onStartLink) onStartLink(data.id)
          }}
        />
      )}
    </div>
  )
}
