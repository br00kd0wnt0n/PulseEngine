import { useState, useRef, useEffect } from 'react'
import Node, { NodeData } from './Node'

type CanvasProps = {
  nodes: NodeData[]
  onNodesChange: (nodes: NodeData[]) => void
  renderNodeContent?: (node: NodeData) => React.ReactNode
}

export default function Canvas({ nodes, onNodesChange, renderNodeContent }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)

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

  return (
    <div ref={canvasRef} className="relative w-full h-screen overflow-hidden bg-charcoal-900">
      {/* Optional WebGL Background Iframe */}
      {/* <iframe src="/webgl-background" className="absolute inset-0 w-full h-full pointer-events-none" /> */}

      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      {/* SVG for connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        <defs>
          <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3be8ff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#EB008B" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        {renderConnections()}
      </svg>

      {/* Nodes */}
      {nodes.map(node => (
        <Node
          key={node.id}
          data={node}
          onUpdate={handleNodeUpdate}
          onFocus={handleNodeFocus}
        >
          {renderNodeContent?.(node)}
        </Node>
      ))}
    </div>
  )
}
