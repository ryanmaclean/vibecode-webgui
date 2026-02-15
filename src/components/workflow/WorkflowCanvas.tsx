/**
 * WorkflowCanvas Component
 *
 * Interactive canvas for visualizing and editing workflow graphs.
 * Renders nodes and edges with drag-and-drop support and edge connection tools.
 *
 * Features:
 * - SVG-based edge rendering with curved paths
 * - Interactive edge creation (click source, click target)
 * - Node positioning and dragging
 * - Visual feedback for connections
 * - Grid background for alignment
 * - Support for edge labels and conditions
 *
 * @module components/workflow/WorkflowCanvas
 */

'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Grid, Link2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
} from '@/lib/workflow/types'

// ============================================================================
// Type Definitions
// ============================================================================

export interface WorkflowCanvasProps {
  /** Workflow definition to render */
  workflow: WorkflowDefinition
  /** Read-only mode */
  readOnly?: boolean
  /** Canvas container ref */
  canvasRef?: React.RefObject<HTMLDivElement>
  /** Drag over handler for node palette */
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void
  /** Drop handler for node palette */
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void
  /** Dragged node type from palette */
  draggedNodeType?: NodeType | null
  /** Callback when nodes are updated */
  onNodesChange?: (nodes: WorkflowNode[]) => void
  /** Callback when edges are updated */
  onEdgesChange?: (edges: WorkflowEdge[]) => void
  /** Callback when a node is selected */
  onNodeSelect?: (nodeId: string | null) => void
  /** Callback when an edge is selected */
  onEdgeSelect?: (edgeId: string | null) => void
}

interface NodeDimensions {
  width: number
  height: number
}

interface Point {
  x: number
  y: number
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get node center point for edge connections
 */
function getNodeCenter(node: WorkflowNode, dimensions: NodeDimensions): Point {
  const x = (node.position?.x || 0) + dimensions.width / 2
  const y = (node.position?.y || 0) + dimensions.height / 2
  return { x, y }
}

/**
 * Calculate curved path between two points
 */
function getCurvedPath(start: Point, end: Point): string {
  const dx = end.x - start.x
  const dy = end.y - start.y

  // Control point offset for curve
  const controlOffset = Math.min(Math.abs(dx) / 2, 100)

  // Bezier curve path
  return `M ${start.x} ${start.y} C ${start.x + controlOffset} ${start.y}, ${end.x - controlOffset} ${end.y}, ${end.x} ${end.y}`
}

/**
 * Calculate arrow head points
 */
function getArrowPoints(start: Point, end: Point, size = 8): string {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const angle = Math.atan2(dy, dx)

  const arrowAngle = Math.PI / 6 // 30 degrees

  const x1 = end.x - size * Math.cos(angle - arrowAngle)
  const y1 = end.y - size * Math.sin(angle - arrowAngle)

  const x2 = end.x - size * Math.cos(angle + arrowAngle)
  const y2 = end.y - size * Math.sin(angle + arrowAngle)

  return `${end.x},${end.y} ${x1},${y1} ${x2},${y2}`
}

/**
 * Get midpoint of edge for label placement
 */
function getEdgeMidpoint(start: Point, end: Point): Point {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * WorkflowCanvas Component
 *
 * Renders an interactive canvas for workflow graph visualization and editing.
 */
export function WorkflowCanvas({
  workflow,
  readOnly = false,
  canvasRef,
  onDragOver,
  onDrop,
  draggedNodeType,
  onNodesChange,
  onEdgesChange,
  onNodeSelect,
  onEdgeSelect,
}: WorkflowCanvasProps) {
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 })

  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Standard node dimensions (adjust based on actual rendering)
  const nodeDimensions: NodeDimensions = { width: 250, height: 100 }

  const isEmpty = workflow.nodes.length === 0

  // Handle node click for connection mode
  const handleNodeClick = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      if (readOnly) return

      // Prevent if clicking on delete button
      if ((event.target as HTMLElement).closest('[data-delete-button]')) {
        return
      }

      if (connectingFrom === null) {
        // Start connection
        setConnectingFrom(nodeId)
        setSelectedNode(null)
        setSelectedEdge(null)
        onNodeSelect?.(null)
        onEdgeSelect?.(null)
      } else if (connectingFrom === nodeId) {
        // Cancel connection
        setConnectingFrom(null)
      } else {
        // Complete connection
        const edgeId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const newEdge: WorkflowEdge = {
          id: edgeId,
          source: connectingFrom,
          target: nodeId,
        }

        // Add edge to workflow
        const updatedEdges = [...workflow.edges, newEdge]
        onEdgesChange?.(updatedEdges)

        setConnectingFrom(null)
      }
    },
    [connectingFrom, readOnly, workflow.edges, onEdgesChange, onNodeSelect, onEdgeSelect]
  )

  // Handle node selection
  const handleNodeSelect = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      if (readOnly || connectingFrom !== null) return

      event.stopPropagation()
      setSelectedNode(nodeId)
      setSelectedEdge(null)
      onNodeSelect?.(nodeId)
      onEdgeSelect?.(null)
    },
    [readOnly, connectingFrom, onNodeSelect, onEdgeSelect]
  )

  // Handle edge selection
  const handleEdgeSelect = useCallback(
    (edgeId: string, event: React.MouseEvent) => {
      if (readOnly) return

      event.stopPropagation()
      setSelectedEdge(edgeId)
      setSelectedNode(null)
      onEdgeSelect?.(edgeId)
      onNodeSelect?.(null)
    },
    [readOnly, onEdgeSelect, onNodeSelect]
  )

  // Handle edge deletion
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      if (readOnly) return

      const updatedEdges = workflow.edges.filter(e => e.id !== edgeId)
      onEdgesChange?.(updatedEdges)
      setSelectedEdge(null)
      onEdgeSelect?.(null)
    },
    [readOnly, workflow.edges, onEdgesChange, onEdgeSelect]
  )

  // Handle node deletion
  const handleDeleteNode = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      if (readOnly) return

      event.stopPropagation()

      // Remove node
      const updatedNodes = workflow.nodes.filter(n => n.id !== nodeId)
      onNodesChange?.(updatedNodes)

      // Remove connected edges
      const updatedEdges = workflow.edges.filter(
        e => e.source !== nodeId && e.target !== nodeId
      )
      onEdgesChange?.(updatedEdges)

      setSelectedNode(null)
      onNodeSelect?.(null)
    },
    [readOnly, workflow.nodes, workflow.edges, onNodesChange, onEdgesChange, onNodeSelect]
  )

  // Handle node drag start
  const handleNodeDragStart = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      if (readOnly || connectingFrom !== null) return

      event.stopPropagation()

      const node = workflow.nodes.find(n => n.id === nodeId)
      if (!node) return

      const nodeElement = nodeRefs.current.get(nodeId)
      if (!nodeElement) return

      const rect = nodeElement.getBoundingClientRect()
      const canvas = canvasRef?.current
      if (!canvas) return

      const canvasRect = canvas.getBoundingClientRect()

      setDraggingNode(nodeId)
      setDragOffset({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
    },
    [readOnly, connectingFrom, workflow.nodes, canvasRef]
  )

  // Handle node drag
  useEffect(() => {
    if (!draggingNode) return

    const handleMouseMove = (event: MouseEvent) => {
      const canvas = canvasRef?.current
      if (!canvas) return

      const canvasRect = canvas.getBoundingClientRect()
      const scrollLeft = canvas.scrollLeft
      const scrollTop = canvas.scrollTop

      const newX = event.clientX - canvasRect.left + scrollLeft - dragOffset.x
      const newY = event.clientY - canvasRect.top + scrollTop - dragOffset.y

      // Update node position
      const updatedNodes = workflow.nodes.map(n =>
        n.id === draggingNode
          ? { ...n, position: { x: Math.max(0, newX), y: Math.max(0, newY) } }
          : n
      )
      onNodesChange?.(updatedNodes)
    }

    const handleMouseUp = () => {
      setDraggingNode(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingNode, dragOffset, workflow.nodes, onNodesChange, canvasRef])

  // Calculate canvas bounds for SVG
  const canvasBounds = useMemo(() => {
    if (workflow.nodes.length === 0) {
      return { width: 2000, height: 2000 }
    }

    let maxX = 0
    let maxY = 0

    workflow.nodes.forEach(node => {
      const x = (node.position?.x || 0) + nodeDimensions.width
      const y = (node.position?.y || 0) + nodeDimensions.height
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    })

    return {
      width: Math.max(maxX + 200, 2000),
      height: Math.max(maxY + 200, 2000),
    }
  }, [workflow.nodes, nodeDimensions])

  // Handle canvas click (deselect)
  const handleCanvasClick = useCallback(() => {
    if (connectingFrom !== null) {
      setConnectingFrom(null)
    } else {
      setSelectedNode(null)
      setSelectedEdge(null)
      onNodeSelect?.(null)
      onEdgeSelect?.(null)
    }
  }, [connectingFrom, onNodeSelect, onEdgeSelect])

  return (
    <div
      data-testid="workflow-canvas"
      ref={canvasRef}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={handleCanvasClick}
      className="relative h-full w-full overflow-auto bg-slate-50 dark:bg-slate-900"
    >
      {/* Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(226 232 240 / 0.3) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(226 232 240 / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Connection Mode Indicator */}
      {connectingFrom && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
          <Badge variant="default" className="flex items-center gap-2">
            <Link2 className="h-3 w-3" />
            Click target node to connect
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 ml-2"
              onClick={() => setConnectingFrom(null)}
            >
              ×
            </Button>
          </Badge>
        </div>
      )}

      {/* Canvas Content */}
      <div className="relative" style={{ width: canvasBounds.width, height: canvasBounds.height }}>
        {isEmpty ? (
          <div className="flex h-full items-center justify-center absolute inset-0">
            <div className="text-center">
              <Grid className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-slate-100">
                {draggedNodeType ? 'Drop Node Here' : 'Empty Canvas'}
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {draggedNodeType
                  ? `Drop the ${draggedNodeType} node onto the canvas`
                  : readOnly
                    ? 'No nodes in this workflow'
                    : 'Drag nodes from the palette to build your workflow'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* SVG Layer for Edges */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={canvasBounds.width}
              height={canvasBounds.height}
              style={{ zIndex: 1 }}
            >
              <defs>
                {/* Arrow marker for edges */}
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="currentColor" className="text-slate-400" />
                </marker>
                <marker
                  id="arrowhead-selected"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="currentColor" className="text-primary" />
                </marker>
              </defs>

              {/* Render edges */}
              {workflow.edges.map(edge => {
                const sourceNode = workflow.nodes.find(n => n.id === edge.source)
                const targetNode = workflow.nodes.find(n => n.id === edge.target)

                if (!sourceNode || !targetNode) return null

                const start = getNodeCenter(sourceNode, nodeDimensions)
                const end = getNodeCenter(targetNode, nodeDimensions)
                const path = getCurvedPath(start, end)
                const midpoint = getEdgeMidpoint(start, end)

                const isSelected = selectedEdge === edge.id

                return (
                  <g key={edge.id}>
                    {/* Edge path */}
                    <path
                      data-testid="workflow-edge"
                      d={path}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={isSelected ? 3 : 2}
                      className={cn(
                        'pointer-events-auto cursor-pointer transition-all',
                        isSelected ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
                      )}
                      markerEnd={isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
                      onClick={(e) => handleEdgeSelect(edge.id, e)}
                    />

                    {/* Edge label */}
                    {edge.label && (
                      <g transform={`translate(${midpoint.x}, ${midpoint.y})`}>
                        <rect
                          x="-30"
                          y="-10"
                          width="60"
                          height="20"
                          fill="white"
                          stroke="currentColor"
                          strokeWidth="1"
                          className="text-slate-300"
                          rx="4"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="text-xs fill-slate-700 pointer-events-none"
                        >
                          {edge.label}
                        </text>
                      </g>
                    )}

                    {/* Delete button for selected edge */}
                    {isSelected && !readOnly && (
                      <g
                        transform={`translate(${midpoint.x}, ${midpoint.y})`}
                        className="pointer-events-auto cursor-pointer"
                        onClick={() => handleDeleteEdge(edge.id)}
                      >
                        <circle r="12" fill="white" stroke="currentColor" strokeWidth="1" className="text-slate-300" />
                        <circle r="10" fill="currentColor" className="text-destructive" />
                        <text
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="text-xs fill-white font-bold pointer-events-none"
                        >
                          ×
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Nodes Layer */}
            <div className="relative" style={{ zIndex: 2 }}>
              {workflow.nodes.map(node => {
                const isConnecting = connectingFrom === node.id
                const isHovered = hoveredNode === node.id
                const isSelected = selectedNode === node.id
                const isDragging = draggingNode === node.id

                return (
                  <div
                    key={node.id}
                    data-testid={`node-${node.type}`}
                    ref={(el) => {
                      if (el) nodeRefs.current.set(node.id, el)
                      else nodeRefs.current.delete(node.id)
                    }}
                    className={cn(
                      'absolute rounded-lg border-2 bg-card p-4 shadow-md transition-all',
                      readOnly ? 'cursor-default' : 'cursor-pointer',
                      isConnecting && 'border-primary ring-2 ring-primary ring-offset-2',
                      isSelected && 'border-primary',
                      !isConnecting && !isSelected && 'border-primary/20 hover:border-primary/40 hover:shadow-lg',
                      isDragging && 'opacity-50'
                    )}
                    style={{
                      left: node.position?.x || 100,
                      top: node.position?.y || 100,
                      minWidth: '200px',
                      maxWidth: '300px',
                    }}
                    onClick={(e) => handleNodeClick(node.id, e)}
                    onMouseDown={(e) => handleNodeDragStart(node.id, e)}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-xs">
                          {node.type}
                        </Badge>
                        {!readOnly && (isHovered || isSelected) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            data-delete-button
                            onClick={(e) => handleDeleteNode(node.id, e)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <h4 className="font-medium text-sm">{node.name}</h4>
                      {node.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {node.description}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Drop overlay when dragging from palette */}
            {draggedNodeType && (
              <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary/30 pointer-events-none flex items-center justify-center" style={{ zIndex: 3 }}>
                <p className="text-sm text-muted-foreground">
                  Drop to add {draggedNodeType} node
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
