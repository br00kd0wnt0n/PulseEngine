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
  onCourseCorrect?: (nodeId: string, nodeTitle: string) => void // Launch Course Correct for this node
}

type NodeProps = {
  data: NodeData
  onUpdate: (id: string, updates: Partial<NodeData>) => void
  onFocus: (id: string) => void
  onStartLink?: (id: string) => void
  onAdd?: (id: string, anchor?: { x: number; y: number }) => void
  onRemove?: (id: string) => void
  scale?: number
  getCanvasBounds?: () => DOMRect | null
  children: React.ReactNode
}

export default function Node({ data, onUpdate, onFocus, onStartLink, onAdd, onRemove, scale = 1, getCanvasBounds, children }: NodeProps) {
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
    // Wildcard: yellow to match Roll Wildcard button
    if (data.type === 'wildcard') {
      return 'border-yellow-400/40 bg-yellow-400/10'
    }
    // Integrations: status-aware styling
    if (data.type === 'integration') {
      if (data.status === 'active' || data.status === 'complete') {
        return 'border-emerald-400/50 bg-emerald-400/10'
      }
      if (data.status === 'processing') {
        return 'border-emerald-400/30 bg-emerald-400/5 animate-pulse'
      }
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
      if (data.status === 'active' || data.status === 'complete' || data.status === 'processing') {
        return 'hover:ring-2 hover:ring-emerald-400/50 hover:shadow-xl hover:shadow-emerald-400/40'
      }
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

  // Show Course Correct button on content nodes (not on utility/input nodes or course-correct itself)
  const showCourseCorrectButton = !['course-correct', 'integration', 'rkb', 'input', 'user-input', 'upload', 'brief-input', 'context-upload'].includes(data.type)
    && !data.id.startsWith('course-correct')
    && !['brief-input', 'context-upload', 'rkb'].includes(data.id)

  const hideRemoveFor = new Set(['brief-input','context-upload','rkb','clarifying-questions','gwi','glimpse'])
  const canRemove = !!onRemove && !hideRemoveFor.has(data.id)

  return (
    <div
      ref={nodeRef}
      className={`absolute rounded-lg border-2 backdrop-blur-sm transition-all duration-300 ease-out transform-gpu relative ${nodeColor} ${hoverGlow}`}
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
      {/* Left/Right side affordances */}
      {canRemove && (
        <button
          title="Remove"
          className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 border border-white/20 text-white/70 text-xs hover:bg-white/20"
          onMouseDown={(e)=>{ e.stopPropagation(); onRemove(data.id) }}
        >−</button>
      )}
      {onAdd && (
        <button
          title="Add next"
          className="absolute right-[-10px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 border border-white/20 text-white/70 text-xs hover:bg-white/20"
          onMouseDown={(e)=>{ 
            e.stopPropagation(); 
            const rect = getCanvasBounds?.() || { left: 0, top: 0 } as any
            const scale = (window as any).__canvasScale || 1
            const nodeW = data.minimized ? 240 : data.width
            const nodeH = data.minimized ? 48 : data.height
            const ax = (rect.left || 0) + scale * (data.x + nodeW)
            const ay = (rect.top || 0) + scale * (data.y + nodeH/2)
            onAdd(data.id, { x: ax, y: ay })
          }}
        >+</button>
      )}
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            (data.status === 'active' && data.type === 'wildcard') ? 'bg-yellow-400' :
            (data.status === 'active' && data.type === 'course-correct') ? 'bg-purple-400' :
            (data.status === 'active' && data.type === 'integration') ? 'bg-emerald-400' :
            ((data.status === 'complete' || data.status === 'processing') && data.type === 'integration') ? 'bg-emerald-400' :
            data.status === 'active' ? 'bg-ralph-cyan' :
            data.status === 'complete' ? 'bg-ralph-pink' :
            data.status === 'processing' ? 'bg-ralph-pink animate-pulse' :
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
        <>
          <div className="node-content p-3 overflow-auto" style={{ height: data.height - 48 - (showCourseCorrectButton ? 36 : 0) }}>
            {children}
          </div>
          {data.status === 'processing' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="px-3 py-2 rounded-lg border border-white/10 bg-black/30 backdrop-blur-sm text-center">
                <div className="mx-auto mb-1 h-7 w-7 rounded-full border-2 border-white/30 border-t-ralph-cyan animate-spin" />
                <div className="text-[11px] text-white/80">Processing…</div>
              </div>
            </div>
          )}
          {/* Course Correct button - shown on content nodes */}
          {showCourseCorrectButton && data.onCourseCorrect && (
            <div className="absolute bottom-5 left-3 right-3">
              <button
                onClick={(e) => { e.stopPropagation(); data.onCourseCorrect?.(data.id, data.title) }}
                className="w-full px-2 py-1.5 rounded border border-purple-400/40 bg-purple-500/20 hover:bg-purple-500/40 text-[10px] text-purple-200 font-medium transition-colors"
              >
                Course Correct
              </button>
            </div>
          )}
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
