/**
 * MultiAgentWorkspace Component
 *
 * Split-screen layout for parallel agent conversations with drag-to-reorder,
 * context synchronization, and comparative response view.
 *
 * Features:
 * - Split-screen layout for multiple agents
 * - Drag-to-reorder agent panels
 * - Context synchronization toggle
 * - Comparative response view
 * - Flexible grid layouts (2-4 agents)
 * - Agent performance metrics comparison
 *
 * @module components/ai/MultiAgentWorkspace
 */

'use client'

import React, { useState, useCallback, useMemo } from 'react'
import {
  Layout,
  Grid,
  Maximize2,
  Minimize2,
  Link as LinkIcon,
  Unlink,
  BarChart3,
  GripVertical
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { UnifiedAgentChat } from './UnifiedAgentChat'
import type { AgentResponse } from '@/types/agent-api'

// ============================================================================
// Type Definitions
// ============================================================================

interface AgentPanel {
  id: string
  agent: AgentResponse
  isExpanded: boolean
  position: number
}

interface MultiAgentWorkspaceProps {
  /** Active agents to display */
  agents: AgentResponse[]
  /** Enable context synchronization across agents */
  enableContextSync?: boolean
  /** Show comparative metrics view */
  showMetrics?: boolean
  /** Callback when message is sent to any agent */
  onMessageSend?: (agentId: string, message: string) => void
  /** Custom className */
  className?: string
  /** Maximum number of agents to display simultaneously */
  maxAgents?: number
}

interface LayoutMode {
  id: string
  name: string
  icon: React.ReactNode
  gridClass: string
  maxAgents: number
}

interface AgentMetrics {
  agentId: string
  responseTime: number
  messageCount: number
  tokensUsed: number
  errorRate: number
}

// ============================================================================
// Constants
// ============================================================================

const LAYOUT_MODES: LayoutMode[] = [
  {
    id: 'single',
    name: 'Single',
    icon: <Maximize2 className="h-4 w-4" aria-hidden="true" />,
    gridClass: 'grid-cols-1',
    maxAgents: 1
  },
  {
    id: 'split-2',
    name: '2 Panels',
    icon: <Layout className="h-4 w-4" aria-hidden="true" />,
    gridClass: 'grid-cols-2',
    maxAgents: 2
  },
  {
    id: 'grid-4',
    name: '4 Panels',
    icon: <Grid className="h-4 w-4" aria-hidden="true" />,
    gridClass: 'grid-cols-2',
    maxAgents: 4
  }
]

// ============================================================================
// Agent Metrics Card Component
// ============================================================================

interface MetricsCardProps {
  metrics: AgentMetrics[]
  className?: string
}

function MetricsCard({ metrics, className }: MetricsCardProps) {
  // Calculate averages
  const avgResponseTime = useMemo(() => {
    if (metrics.length === 0) return 0
    return metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length
  }, [metrics])

  const totalMessages = useMemo(() => {
    return metrics.reduce((sum, m) => sum + m.messageCount, 0)
  }, [metrics])

  const totalTokens = useMemo(() => {
    return metrics.reduce((sum, m) => sum + m.tokensUsed, 0)
  }, [metrics])

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          Performance Metrics
        </h3>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold">{avgResponseTime.toFixed(0)}ms</div>
          <div className="text-xs text-muted-foreground">Avg Response</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{totalMessages}</div>
          <div className="text-xs text-muted-foreground">Total Messages</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{(totalTokens / 1000).toFixed(1)}K</div>
          <div className="text-xs text-muted-foreground">Tokens Used</div>
        </div>
      </div>

      {/* Individual Agent Metrics */}
      <div className="space-y-2">
        {metrics.map((metric) => (
          <div
            key={metric.agentId}
            className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
          >
            <span className="font-medium truncate flex-1">
              {metric.agentId}
            </span>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>{metric.responseTime}ms</span>
              <span>{metric.messageCount} msgs</span>
              {metric.errorRate > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {(metric.errorRate * 100).toFixed(0)}% errors
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ============================================================================
// Draggable Panel Component
// ============================================================================

interface DraggablePanelProps {
  panel: AgentPanel
  layoutMode: LayoutMode
  contextSyncEnabled: boolean
  onExpand: (id: string) => void
  onMessageSend: (agentId: string, message: string) => void
  onDragStart: (id: string) => void
  onDragOver: (id: string) => void
  onDragEnd: () => void
}

function DraggablePanel({
  panel,
  layoutMode,
  contextSyncEnabled,
  onExpand,
  onMessageSend,
  onDragStart,
  onDragOver,
  onDragEnd
}: DraggablePanelProps) {
  const [isDragging, setIsDragging] = useState(false)

  return (
    <div
      className={cn(
        "relative transition-all duration-200",
        panel.isExpanded && layoutMode.maxAgents > 1 ? "col-span-2 row-span-2" : "",
        isDragging && "opacity-50"
      )}
      draggable
      onDragStart={() => {
        setIsDragging(true)
        onDragStart(panel.id)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(panel.id)
      }}
      onDragEnd={() => {
        setIsDragging(false)
        onDragEnd()
      }}
      onDrop={(e) => {
        e.preventDefault()
      }}
    >
      {/* Drag Handle */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 cursor-move"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </Button>
        {layoutMode.maxAgents > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onExpand(panel.id)}
            aria-label={panel.isExpanded ? "Minimize panel" : "Maximize panel"}
          >
            {panel.isExpanded ? (
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        )}
      </div>

      {/* Context Sync Indicator */}
      {contextSyncEnabled && (
        <div className="absolute top-2 left-2 z-10">
          <Badge variant="outline" className="text-xs">
            <LinkIcon className="h-3 w-3 mr-1" aria-hidden="true" />
            Synced
          </Badge>
        </div>
      )}

      {/* Agent Chat */}
      <UnifiedAgentChat
        agent={panel.agent}
        onMessageSend={(msg) => onMessageSend(panel.agent.agent_id, msg)}
        enableMentions={layoutMode.maxAgents > 1}
        className="h-full"
      />
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function MultiAgentWorkspace({
  agents,
  enableContextSync = false,
  showMetrics = false,
  onMessageSend,
  className,
  maxAgents = 4
}: MultiAgentWorkspaceProps) {
  const [panels, setPanels] = useState<AgentPanel[]>(() =>
    agents.slice(0, maxAgents).map((agent, index) => ({
      id: agent.agent_id,
      agent,
      isExpanded: false,
      position: index
    }))
  )

  const [layoutMode, setLayoutMode] = useState<LayoutMode>(
    LAYOUT_MODES[Math.min(agents.length - 1, 1)]
  )

  const [contextSyncEnabled, setContextSyncEnabled] = useState(enableContextSync)
  const [showMetricsView, setShowMetricsView] = useState(showMetrics)
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null)

  // Mock metrics (in production, these would come from actual monitoring)
  const agentMetrics = useMemo<AgentMetrics[]>(() => {
    return panels.map(panel => ({
      agentId: panel.agent.agent_id,
      responseTime: Math.random() * 500 + 100,
      messageCount: Math.floor(Math.random() * 20),
      tokensUsed: Math.floor(Math.random() * 5000 + 1000),
      errorRate: Math.random() * 0.1
    }))
  }, [panels])

  // Update panels when agents change
  React.useEffect(() => {
    setPanels(
      agents.slice(0, maxAgents).map((agent, index) => {
        const existingPanel = panels.find(p => p.id === agent.agent_id)
        return existingPanel || {
          id: agent.agent_id,
          agent,
          isExpanded: false,
          position: index
        }
      })
    )
  }, [agents, maxAgents])

  // Adjust layout mode based on agent count
  React.useEffect(() => {
    const agentCount = panels.length
    if (agentCount === 1) {
      setLayoutMode(LAYOUT_MODES[0])
    } else if (agentCount === 2) {
      setLayoutMode(LAYOUT_MODES[1])
    } else if (agentCount > 2) {
      setLayoutMode(LAYOUT_MODES[2])
    }
  }, [panels.length])

  const handleExpandPanel = useCallback((panelId: string) => {
    setPanels(prev =>
      prev.map(panel => ({
        ...panel,
        isExpanded: panel.id === panelId ? !panel.isExpanded : false
      }))
    )
  }, [])

  const handleMessageSend = useCallback((agentId: string, message: string) => {
    onMessageSend?.(agentId, message)

    // If context sync is enabled, send to all agents
    if (contextSyncEnabled) {
      panels.forEach(panel => {
        if (panel.agent.agent_id !== agentId) {
          onMessageSend?.(panel.agent.agent_id, message)
        }
      })
    }
  }, [contextSyncEnabled, panels, onMessageSend])

  const handleDragStart = useCallback((panelId: string) => {
    setDraggedPanelId(panelId)
  }, [])

  const handleDragOver = useCallback((targetPanelId: string) => {
    if (!draggedPanelId || draggedPanelId === targetPanelId) return

    setPanels(prev => {
      const draggedIndex = prev.findIndex(p => p.id === draggedPanelId)
      const targetIndex = prev.findIndex(p => p.id === targetPanelId)

      if (draggedIndex === -1 || targetIndex === -1) return prev

      const newPanels = [...prev]
      const [draggedPanel] = newPanels.splice(draggedIndex, 1)
      newPanels.splice(targetIndex, 0, draggedPanel)

      return newPanels.map((panel, index) => ({
        ...panel,
        position: index
      }))
    })
  }, [draggedPanelId])

  const handleDragEnd = useCallback(() => {
    setDraggedPanelId(null)
  }, [])

  const visiblePanels = useMemo(() => {
    return panels.slice(0, layoutMode.maxAgents)
  }, [panels, layoutMode])

  return (
    <div className={cn("flex flex-col h-full gap-3", className)}>
      {/* Control Bar */}
      <Card className="p-3">
        <div className="flex items-center justify-between gap-4">
          {/* Layout Mode Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Layout:</span>
            {LAYOUT_MODES.map(mode => (
              <Button
                key={mode.id}
                variant={layoutMode.id === mode.id ? "default" : "outline"}
                size="sm"
                onClick={() => setLayoutMode(mode)}
                disabled={panels.length < mode.maxAgents && mode.id !== 'single'}
                aria-label={`Switch to ${mode.name} layout`}
              >
                {mode.icon}
                <span className="ml-1.5">{mode.name}</span>
              </Button>
            ))}
          </div>

          {/* Context Sync Toggle */}
          {panels.length > 1 && (
            <div className="flex items-center gap-2">
              <Switch
                id="context-sync"
                checked={contextSyncEnabled}
                onCheckedChange={setContextSyncEnabled}
                aria-label="Toggle context synchronization"
              />
              <Label htmlFor="context-sync" className="text-sm cursor-pointer">
                {contextSyncEnabled ? (
                  <span className="flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" aria-hidden="true" />
                    Context Synced
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Unlink className="h-3 w-3" aria-hidden="true" />
                    Independent
                  </span>
                )}
              </Label>
            </div>
          )}

          {/* Metrics Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={showMetricsView ? "default" : "outline"}
              size="sm"
              onClick={() => setShowMetricsView(!showMetricsView)}
              aria-label="Toggle metrics view"
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              <span className="ml-1.5">Metrics</span>
            </Button>
          </div>

          {/* Agent Count */}
          <Badge variant="secondary">
            {panels.length} {panels.length === 1 ? 'Agent' : 'Agents'}
          </Badge>
        </div>
      </Card>

      {/* Workspace Grid */}
      <div className="flex-1 grid gap-3" style={{ minHeight: 0 }}>
        <div
          className={cn(
            "grid gap-3 h-full",
            layoutMode.gridClass
          )}
          style={{ gridAutoRows: 'minmax(0, 1fr)' }}
        >
          {visiblePanels.map(panel => (
            <DraggablePanel
              key={panel.id}
              panel={panel}
              layoutMode={layoutMode}
              contextSyncEnabled={contextSyncEnabled}
              onExpand={handleExpandPanel}
              onMessageSend={handleMessageSend}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>

        {/* Metrics Sidebar */}
        {showMetricsView && (
          <MetricsCard
            metrics={agentMetrics}
            className="lg:col-span-1"
          />
        )}
      </div>

      {/* Footer Info */}
      {panels.length > layoutMode.maxAgents && (
        <div className="text-xs text-muted-foreground text-center py-2 px-4 bg-muted/50 rounded">
          Showing {layoutMode.maxAgents} of {panels.length} agents.
          Change layout to view more.
        </div>
      )}
    </div>
  )
}
