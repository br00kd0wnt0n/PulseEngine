import { useState, useRef, useEffect } from 'react'
import Node, { NodeData } from './Node'

type CanvasProps = {
  nodes: NodeData[]
  onNodesChange: (nodes: NodeData[]) => void
  renderNodeContent?: (node: NodeData) => React.ReactNode
}

export default function Canvas({ nodes, onNodesChange, renderNodeContent }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const [linkFrom, setLinkFrom] = useState<string | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [scale, setScale] = useState<number>(() => {
    try { return Number(localStorage.getItem('canvas:scale') || '1') || 1 } catch { return 1 }
  })

  const handleNodeUpdate = (id: string, updates: Partial<NodeData>) => {
    onNodesChange(nodes.map(n => n.id === id ? { ...n, ...updates } : n))
  }

  const handleNodeFocus = (id: string) => {
    setFocusedNodeId(id)
    // Bring focused node to front
    const maxZ = Math.max(...nodes.map(n => n.zIndex))
    onNodesChange(nodes.map(n =>
      n.id === id ? { ...n, zIndex: maxZ + 1 } : n
    ))
  }

  const startLink = (id: string) => {
    setLinkFrom(id)
    setDragPos(null)
  }

  // Track mouse for link dragging
  useEffect(() => {
    if (!linkFrom) return
    const handleMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      setDragPos({ x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale })
    }
    const handleUp = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) { setLinkFrom(null); setDragPos(null); return }
      const upPos = { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale }
      // Find node under cursor (top-most by zIndex)
      const sorted = [...nodes].sort((a,b) => b.zIndex - a.zIndex)
      const target = sorted.find(n => {
        const w = n.minimized ? 240 : n.width
        const h = n.minimized ? 48 : n.height
        return upPos.x >= n.x && upPos.x <= n.x + w && upPos.y >= n.y && upPos.y <= n.y + h
      })
      if (target && target.id !== linkFrom) {
        onNodesChange(nodes.map(n => {
          if (n.id !== linkFrom) return n
          const existing = new Set(n.connectedTo || [])
          existing.add(target.id)
          return { ...n, connectedTo: Array.from(existing) }
        }))
      }
      setLinkFrom(null)
      setDragPos(null)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [linkFrom, nodes, onNodesChange])

  // Draw connection lines between nodes
  const renderConnections = () => {
    const lines: JSX.Element[] = []

    nodes.forEach(node => {
      if (!node.connectedTo) return

      node.connectedTo.forEach(targetId => {
        const target = nodes.find(n => n.id === targetId)
        if (!target) return

        // Calculate connection points (right of source to left of target)
        const sourceX = node.x + (node.minimized ? 240 : node.width)
        const sourceY = node.y + (node.minimized ? 24 : node.height / 2)
        const targetX = target.x
        const targetY = target.y + (target.minimized ? 24 : target.height / 2)

        // Create curved path
        const midX = (sourceX + targetX) / 2
        const path = `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`

        lines.push(
          <path
            key={`${node.id}-${targetId}`}
            d={path}
            stroke="url(#connectionGradient)"
            strokeWidth="2"
            fill="none"
            className="transition-all"
            style={{ opacity: 0.6 }}
          />
        )
      })
    })

    return lines
  }

  const renderTempLink = () => {
    if (!linkFrom || !dragPos) return null
    const src = nodes.find(n => n.id === linkFrom)
    if (!src) return null
    const sourceX = src.x + (src.minimized ? 240 : src.width)
    const sourceY = src.y + (src.minimized ? 24 : src.height / 2)
    const midX = (sourceX + dragPos.x) / 2
    const path = `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${dragPos.y}, ${dragPos.x} ${dragPos.y}`
    return (
      <path d={path} stroke="url(#connectionGradient)" strokeWidth="2" fill="none" style={{ opacity: 0.6 }} />
    )
  }

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
  const setZoom = (next: number) => {
    const v = clamp(parseFloat(next.toFixed(2)), 0.5, 2)
    setScale(v)
    try { localStorage.setItem('canvas:scale', String(v)) } catch {}
  }

  return (
    <div ref={canvasRef} className="relative w-full h-screen overflow-auto bg-charcoal-900">
      {/* Optional WebGL Background Iframe */}
      {/* <iframe src="/webgl-background" className="absolute inset-0 w-full h-full pointer-events-none" /> */}

      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      {/* Scaled inner canvas wrapper */}
      <div
        ref={innerRef}
        className="relative"
        style={{ transform: `scale(${scale})`, transformOrigin: '0 0', width: 2200, height: 1600 }}
      >
        {/* SVG for connection lines (scaled with content) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          <defs>
            <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3be8ff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#EB008B" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          {renderConnections()}
          {renderTempLink()}
        </svg>

        {/* Nodes */}
        {nodes.map(node => (
          <Node
            key={node.id}
            data={node}
            onUpdate={handleNodeUpdate}
            onFocus={handleNodeFocus}
            onStartLink={startLink}
            scale={scale}
            getCanvasBounds={() => canvasRef.current?.getBoundingClientRect() || null}
          >
            {renderNodeContent?.(node)}
          </Node>
        ))}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 z-50 flex items-center gap-2 p-2 rounded-md bg-white/5 border border-white/10 backdrop-blur">
        <button className="px-2 py-1 text-xs rounded border border-white/10 bg-white/10 hover:bg-white/20" onClick={() => setZoom(scale - 0.1)}>-</button>
        <div className="text-xs w-14 text-center">{Math.round(scale * 100)}%</div>
        <button className="px-2 py-1 text-xs rounded border border-white/10 bg-white/10 hover:bg-white/20" onClick={() => setZoom(scale + 0.1)}>+</button>
        <button className="ml-2 px-2 py-1 text-[10px] rounded border border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setZoom(1)}>Reset</button>
      </div>
    </div>
  )
}
