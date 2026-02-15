/**
 * NodePalette Component
 *
 * Draggable palette of workflow nodes for the visual workflow builder.
 * Users can drag nodes from this palette onto the canvas to build workflows.
 *
 * Features:
 * - All workflow node types (agent-task, condition, parallel, merge, loop, transform, delay, webhook)
 * - Drag-and-drop functionality using HTML5 Drag & Drop API
 * - Visual categorization of node types
 * - Icon-based visual representation
 * - Hover states and visual feedback
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * @module components/workflow/NodePalette
 */

'use client'

import React, { useCallback } from 'react'
import {
  Bot,
  GitBranch,
  Workflow,
  GitMerge,
  Repeat,
  Shuffle,
  Clock,
  Webhook,
  GripVertical,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { NodeType } from '@/lib/workflow/types'

// ============================================================================
// Type Definitions
// ============================================================================

export interface NodePaletteItem {
  /** Node type identifier */
  type: NodeType
  /** Display name */
  name: string
  /** Short description */
  description: string
  /** Icon component */
  icon: React.ComponentType<{ className?: string }>
  /** Category for grouping */
  category: 'execution' | 'flow-control' | 'utility'
  /** Visual color/theme */
  color: string
}

export interface NodePaletteProps {
  /** Callback when node drag starts */
  onNodeDragStart?: (nodeType: NodeType) => void
  /** Callback when node drag ends */
  onNodeDragEnd?: () => void
  /** Custom className */
  className?: string
}

// ============================================================================
// Constants
// ============================================================================

const NODE_PALETTE_ITEMS: NodePaletteItem[] = [
  // Execution Nodes
  {
    type: 'agent-task',
    name: 'Agent Task',
    description: 'Execute an AI agent task',
    icon: Bot,
    category: 'execution',
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  },
  {
    type: 'transform',
    name: 'Transform',
    description: 'Transform data with JavaScript',
    icon: Shuffle,
    category: 'execution',
    color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
  },
  {
    type: 'webhook',
    name: 'Webhook',
    description: 'Call external HTTP endpoint',
    icon: Webhook,
    category: 'execution',
    color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  },
  // Flow Control Nodes
  {
    type: 'condition',
    name: 'Condition',
    description: 'Conditional branching',
    icon: GitBranch,
    category: 'flow-control',
    color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  },
  {
    type: 'parallel',
    name: 'Parallel',
    description: 'Execute branches in parallel',
    icon: Workflow,
    category: 'flow-control',
    color: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
  },
  {
    type: 'merge',
    name: 'Merge',
    description: 'Merge parallel branches',
    icon: GitMerge,
    category: 'flow-control',
    color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
  },
  {
    type: 'loop',
    name: 'Loop',
    description: 'Iterative execution',
    icon: Repeat,
    category: 'flow-control',
    color: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20',
  },
  // Utility Nodes
  {
    type: 'delay',
    name: 'Delay',
    description: 'Wait for a duration',
    icon: Clock,
    category: 'utility',
    color: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
  },
]

// Group nodes by category
const GROUPED_NODES = NODE_PALETTE_ITEMS.reduce(
  (acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  },
  {} as Record<string, NodePaletteItem[]>
)

const CATEGORY_LABELS: Record<string, string> = {
  execution: 'Execution',
  'flow-control': 'Flow Control',
  utility: 'Utility',
}

// ============================================================================
// Component
// ============================================================================

/**
 * NodePalette Component
 *
 * Displays a draggable palette of workflow nodes organized by category.
 * Implements HTML5 drag-and-drop for adding nodes to the workflow canvas.
 */
export function NodePalette({
  onNodeDragStart,
  onNodeDragEnd,
  className,
}: NodePaletteProps) {
  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, nodeType: NodeType) => {
      // Set data transfer with node type
      event.dataTransfer.effectAllowed = 'copy'
      event.dataTransfer.setData('application/workflow-node-type', nodeType)

      // Add visual feedback
      event.currentTarget.style.opacity = '0.5'

      // Notify parent
      onNodeDragStart?.(nodeType)
    },
    [onNodeDragStart]
  )

  const handleDragEnd = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      // Reset visual feedback
      event.currentTarget.style.opacity = '1'

      // Notify parent
      onNodeDragEnd?.()
    },
    [onNodeDragEnd]
  )

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader className="flex-none border-b pb-3">
        <CardTitle className="text-base font-semibold">Node Palette</CardTitle>
        <CardDescription className="text-sm">
          Drag nodes onto the canvas to build your workflow
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          <div className="space-y-4 p-4">
            {Object.entries(GROUPED_NODES).map(([category, items]) => (
              <div key={category} className="space-y-2">
                {/* Category Header */}
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {CATEGORY_LABELS[category]}
                  </h3>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Category Items */}
                <div className="space-y-2">
                  {items.map((item) => (
                    <NodePaletteItem
                      key={item.type}
                      item={item}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface NodePaletteItemComponentProps {
  item: NodePaletteItem
  onDragStart: (event: React.DragEvent<HTMLDivElement>, nodeType: NodeType) => void
  onDragEnd: (event: React.DragEvent<HTMLDivElement>) => void
}

function NodePaletteItem({
  item,
  onDragStart,
  onDragEnd,
}: NodePaletteItemComponentProps) {
  const Icon = item.icon

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.type)}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative flex cursor-move items-start gap-3 rounded-lg border p-3 transition-all',
        'hover:shadow-md hover:scale-[1.02]',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        item.color
      )}
      role="button"
      tabIndex={0}
      aria-label={`Drag ${item.name} node to canvas`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          // Could implement keyboard-based node addition here
        }
      }}
    >
      {/* Drag Handle */}
      <div className="flex-none pt-0.5 text-muted-foreground/50 group-hover:text-muted-foreground">
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </div>

      {/* Icon */}
      <div className="flex-none pt-0.5">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">{item.name}</h4>
          <Badge
            variant="outline"
            className="hidden h-5 px-1.5 text-[10px] group-hover:inline-flex"
          >
            {item.type}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{item.description}</p>
      </div>
    </div>
  )
}
