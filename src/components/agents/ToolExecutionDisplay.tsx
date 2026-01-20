/**
 * ToolExecutionDisplay Component
 *
 * Real-time visualization of agent tool executions with status tracking,
 * input/output display, and execution metrics.
 *
 * Features:
 * - Real-time execution status updates
 * - Tool input/output visualization
 * - Execution time and token tracking
 * - Error handling and retry support
 * - Collapsible execution details
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * @module components/agents/ToolExecutionDisplay
 */

'use client'

import React, { useState, useCallback } from 'react'
import {
  Code2,
  FileSearch,
  Zap,
  Play,
  Check,
  X,
  Clock,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// ============================================================================
// Type Definitions
// ============================================================================

export type ToolType = 'code_interpreter' | 'file_search' | 'function'
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface ToolExecution {
  id: string
  toolType: ToolType
  toolName: string
  status: ExecutionStatus
  startTime: Date
  endTime?: Date
  input: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  metadata?: {
    tokenUsage?: number
    executionTime?: number
  }
}

export interface ToolExecutionDisplayProps {
  /** Tool executions to display */
  executions: ToolExecution[]
  /** Callback when retry is requested */
  onRetry?: (executionId: string) => void
  /** Show execution details by default */
  expandedByDefault?: boolean
  /** Custom className */
  className?: string
}

// ============================================================================
// Tool Icon Component
// ============================================================================

function ToolIcon({ toolType, className }: { toolType: ToolType; className?: string }) {
  const icons = {
    code_interpreter: Code2,
    file_search: FileSearch,
    function: Zap
  }

  const Icon = icons[toolType]
  return <Icon className={className} aria-hidden="true" />
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: ExecutionStatus }) {
  const variants = {
    pending: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: Clock },
    running: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Play },
    completed: { color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: Check },
    failed: { color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: X },
    cancelled: { color: 'bg-gray-500/10 text-gray-500 border-gray-500/20', icon: X }
  }

  const variant = variants[status]
  const Icon = variant.icon

  return (
    <Badge
      variant="outline"
      className={cn("flex items-center gap-1 text-xs border", variant.color)}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {status}
    </Badge>
  )
}

// ============================================================================
// Execution Item Component
// ============================================================================

interface ExecutionItemProps {
  execution: ToolExecution
  expandedByDefault: boolean
  onRetry?: () => void
}

function ExecutionItem({ execution, expandedByDefault, onRetry }: ExecutionItemProps) {
  const [isExpanded, setIsExpanded] = useState(expandedByDefault)

  const executionTime = execution.endTime && execution.startTime
    ? execution.endTime.getTime() - execution.startTime.getTime()
    : undefined

  const canRetry = execution.status === 'failed' && onRetry

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={`execution-details-${execution.id}`}
      >
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        <div className="flex-shrink-0">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            execution.status === 'completed' && "bg-green-500/10",
            execution.status === 'failed' && "bg-red-500/10",
            execution.status === 'running' && "bg-blue-500/10",
            execution.status === 'pending' && "bg-yellow-500/10"
          )}>
            <ToolIcon toolType={execution.toolType} className="h-5 w-5" />
          </div>
        </div>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{execution.toolName}</span>
            <StatusBadge status={execution.status} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <time dateTime={execution.startTime.toISOString()}>
              {execution.startTime.toLocaleTimeString()}
            </time>
            {executionTime && (
              <>
                <span>•</span>
                <span>{executionTime}ms</span>
              </>
            )}
            {execution.metadata?.tokenUsage && (
              <>
                <span>•</span>
                <span>{execution.metadata.tokenUsage} tokens</span>
              </>
            )}
          </div>
        </div>

        {canRetry && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onRetry()
            }}
            className="flex-shrink-0"
            aria-label="Retry execution"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </button>

      {/* Details */}
      {isExpanded && (
        <div
          id={`execution-details-${execution.id}`}
          className="border-t bg-muted/30 p-4 space-y-4"
        >
          {/* Input */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              Input
            </h4>
            <div className="bg-background rounded-md p-3 border">
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(execution.input, null, 2)}
              </pre>
            </div>
          </div>

          {/* Output */}
          {execution.output && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                Output
              </h4>
              <div className="bg-background rounded-md p-3 border">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(execution.output, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Error */}
          {execution.error && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Error
              </h4>
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <p className="text-sm text-destructive">{execution.error}</p>
              </div>
            </div>
          )}

          {/* Metadata */}
          {execution.metadata && (
            <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t">
              {execution.metadata.executionTime && (
                <div>
                  <span className="font-medium">Execution Time:</span>{' '}
                  {execution.metadata.executionTime}ms
                </div>
              )}
              {execution.metadata.tokenUsage && (
                <div>
                  <span className="font-medium">Token Usage:</span>{' '}
                  {execution.metadata.tokenUsage}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ToolExecutionDisplay({
  executions,
  onRetry,
  expandedByDefault = false,
  className
}: ToolExecutionDisplayProps) {
  const stats = {
    total: executions.length,
    pending: executions.filter(e => e.status === 'pending').length,
    running: executions.filter(e => e.status === 'running').length,
    completed: executions.filter(e => e.status === 'completed').length,
    failed: executions.filter(e => e.status === 'failed').length
  }

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" aria-hidden="true" />
            Tool Executions
          </CardTitle>
          <div className="flex gap-2">
            {stats.running > 0 && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                {stats.running} running
              </Badge>
            )}
            {stats.failed > 0 && (
              <Badge variant="destructive" className="text-xs">
                {stats.failed} failed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full px-4 py-3">
          {executions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Zap className="h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                No tool executions yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {executions.map((execution) => (
                <ExecutionItem
                  key={execution.id}
                  execution={execution}
                  expandedByDefault={expandedByDefault}
                  onRetry={onRetry ? () => onRetry(execution.id) : undefined}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
