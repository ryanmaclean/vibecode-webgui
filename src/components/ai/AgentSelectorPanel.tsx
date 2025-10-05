/**
 * AgentSelectorPanel Component
 *
 * Grid layout for selecting AI coding agents with real-time status,
 * capability badges, keyboard shortcuts, and smart recommendations.
 *
 * Features:
 * - 6+ agent cards (Aider, Cline, Continue, Claude Code, Goose, OpenCode)
 * - Real-time status indicators (ready/starting/stopped/error)
 * - Agent capability badges (Git expert, Testing specialist, etc.)
 * - Keyboard shortcuts (⌘+1-6 for quick selection)
 * - Smart recommendations based on task type
 *
 * @module components/ai/AgentSelectorPanel
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Play,
  Square,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Code2,
  GitBranch,
  TestTube,
  Zap,
  Sparkles,
  Terminal
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AgentType, AgentStatus } from '@/types/agent-api'

// ============================================================================
// Type Definitions
// ============================================================================

interface AgentCapability {
  id: string
  name: string
  icon: React.ReactNode
  color: string
}

interface AgentDefinition {
  id: AgentType | 'continue' | 'claude-code' | 'opencode'
  name: string
  description: string
  icon: React.ReactNode
  capabilities: AgentCapability[]
  shortcut: string
  bestFor: string[]
  status: AgentStatus | 'ready' | 'starting'
}

interface AgentSelectorPanelProps {
  /** Current task description for smart recommendations */
  taskDescription?: string
  /** Callback when agent is selected */
  onAgentSelect: (agentId: string) => void
  /** Callback when agent is stopped */
  onAgentStop?: (agentId: string) => void
  /** Currently active agent IDs */
  activeAgents?: string[]
  /** Custom className */
  className?: string
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean
}

// ============================================================================
// Constants
// ============================================================================

const CAPABILITIES: Record<string, AgentCapability> = {
  git: {
    id: 'git',
    name: 'Git Expert',
    icon: <GitBranch className="h-3 w-3" aria-hidden="true" />,
    color: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
  },
  testing: {
    id: 'testing',
    name: 'Testing',
    icon: <TestTube className="h-3 w-3" aria-hidden="true" />,
    color: 'bg-green-500/10 text-green-500 border-green-500/20'
  },
  refactoring: {
    id: 'refactoring',
    name: 'Refactoring',
    icon: <Code2 className="h-3 w-3" aria-hidden="true" />,
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
  },
  fast: {
    id: 'fast',
    name: 'Fast',
    icon: <Zap className="h-3 w-3" aria-hidden="true" />,
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
  },
  ai: {
    id: 'ai',
    name: 'AI-Powered',
    icon: <Sparkles className="h-3 w-3" aria-hidden="true" />,
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
  },
  terminal: {
    id: 'terminal',
    name: 'Terminal',
    icon: <Terminal className="h-3 w-3" aria-hidden="true" />,
    color: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
  }
}

const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: 'aider',
    name: 'Aider',
    description: 'AI pair programmer with Git integration',
    icon: <GitBranch className="h-6 w-6" aria-hidden="true" />,
    capabilities: [CAPABILITIES.git, CAPABILITIES.refactoring, CAPABILITIES.ai],
    shortcut: '⌘+1',
    bestFor: ['refactoring', 'git operations', 'code generation'],
    status: 'ready'
  },
  {
    id: 'cline',
    name: 'Cline',
    description: 'Fast autonomous coding assistant',
    icon: <Zap className="h-6 w-6" aria-hidden="true" />,
    capabilities: [CAPABILITIES.fast, CAPABILITIES.terminal, CAPABILITIES.ai],
    shortcut: '⌘+2',
    bestFor: ['quick fixes', 'script automation', 'CLI tasks'],
    status: 'ready'
  },
  {
    id: 'continue',
    name: 'Continue',
    description: 'Intelligent code completion and chat',
    icon: <Code2 className="h-6 w-6" aria-hidden="true" />,
    capabilities: [CAPABILITIES.refactoring, CAPABILITIES.ai],
    shortcut: '⌘+3',
    bestFor: ['code completion', 'inline suggestions', 'documentation'],
    status: 'ready'
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Advanced reasoning for complex tasks',
    icon: <Sparkles className="h-6 w-6" aria-hidden="true" />,
    capabilities: [CAPABILITIES.refactoring, CAPABILITIES.testing, CAPABILITIES.ai],
    shortcut: '⌘+4',
    bestFor: ['architecture design', 'complex refactoring', 'debugging'],
    status: 'ready'
  },
  {
    id: 'goose',
    name: 'Goose',
    description: 'Multi-step task automation',
    icon: <Terminal className="h-6 w-6" aria-hidden="true" />,
    capabilities: [CAPABILITIES.terminal, CAPABILITIES.git, CAPABILITIES.fast],
    shortcut: '⌘+5',
    bestFor: ['multi-step tasks', 'deployment', 'CI/CD'],
    status: 'ready'
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Open-source code assistant',
    icon: <Code2 className="h-6 w-6" aria-hidden="true" />,
    capabilities: [CAPABILITIES.refactoring, CAPABILITIES.testing],
    shortcut: '⌘+6',
    bestFor: ['open-source projects', 'documentation', 'code review'],
    status: 'ready'
  }
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Analyze task description and recommend best agent
 */
function getRecommendedAgent(taskDescription: string): string | null {
  if (!taskDescription) return null

  const task = taskDescription.toLowerCase()

  // Git-related tasks
  if (task.includes('commit') || task.includes('branch') || task.includes('merge') || task.includes('git')) {
    return 'aider'
  }

  // Testing tasks
  if (task.includes('test') || task.includes('spec') || task.includes('coverage')) {
    return 'claude-code'
  }

  // Quick fixes
  if (task.includes('fix') || task.includes('bug') || task.includes('quick')) {
    return 'cline'
  }

  // Architecture and design
  if (task.includes('architecture') || task.includes('design') || task.includes('refactor')) {
    return 'claude-code'
  }

  // Deployment and CI/CD
  if (task.includes('deploy') || task.includes('ci') || task.includes('cd') || task.includes('pipeline')) {
    return 'goose'
  }

  // Multi-step tasks
  if (task.includes('multi') || task.includes('complex') || task.includes('automation')) {
    return 'goose'
  }

  return null
}

/**
 * Get status indicator configuration
 */
function getStatusIndicator(status: AgentStatus | 'ready' | 'starting') {
  switch (status) {
    case 'ready':
      return {
        icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
        label: 'Ready',
        color: 'text-green-500',
        bgColor: 'bg-green-500/10'
      }
    case 'running':
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />,
        label: 'Running',
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10'
      }
    case 'starting':
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />,
        label: 'Starting',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10'
      }
    case 'stopped':
      return {
        icon: <Square className="h-4 w-4" aria-hidden="true" />,
        label: 'Stopped',
        color: 'text-gray-500',
        bgColor: 'bg-gray-500/10'
      }
    case 'error':
    case 'failed':
      return {
        icon: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
        label: 'Error',
        color: 'text-red-500',
        bgColor: 'bg-red-500/10'
      }
    case 'completed':
      return {
        icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
        label: 'Completed',
        color: 'text-green-500',
        bgColor: 'bg-green-500/10'
      }
    default:
      return {
        icon: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
        label: 'Unknown',
        color: 'text-gray-500',
        bgColor: 'bg-gray-500/10'
      }
  }
}

// ============================================================================
// Agent Card Component
// ============================================================================

interface AgentCardProps {
  agent: AgentDefinition
  isRecommended: boolean
  isActive: boolean
  onSelect: () => void
  onStop?: () => void
}

function AgentCard({ agent, isRecommended, isActive, onSelect, onStop }: AgentCardProps) {
  const statusIndicator = getStatusIndicator(agent.status)

  return (
    <Card
      className={cn(
        "relative transition-all duration-200 hover:shadow-lg",
        isRecommended && "ring-2 ring-primary ring-offset-2",
        isActive && "bg-primary/5"
      )}
    >
      {isRecommended && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge className="bg-primary text-primary-foreground">
            <Sparkles className="h-3 w-3 mr-1" aria-hidden="true" />
            Recommended
          </Badge>
        </div>
      )}

      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {agent.icon}
            </div>
            <div>
              <CardTitle className="text-lg">{agent.name}</CardTitle>
              <CardDescription className="text-xs mt-1">
                {agent.description}
              </CardDescription>
            </div>
          </div>
          <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border">
            {agent.shortcut}
          </kbd>
        </div>
      </CardHeader>

      <CardContent>
        {/* Status Indicator */}
        <div className={cn("flex items-center gap-2 mb-3 px-3 py-2 rounded-md", statusIndicator.bgColor)}>
          <span className={statusIndicator.color}>
            {statusIndicator.icon}
          </span>
          <span className={cn("text-sm font-medium", statusIndicator.color)}>
            {statusIndicator.label}
          </span>
        </div>

        {/* Capabilities */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {agent.capabilities.map((capability) => (
            <Badge
              key={capability.id}
              variant="outline"
              className={cn("text-xs", capability.color)}
            >
              {capability.icon}
              <span className="ml-1">{capability.name}</span>
            </Badge>
          ))}
        </div>

        {/* Best For */}
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Best for:</span> {agent.bestFor.join(', ')}
        </div>
      </CardContent>

      <CardFooter>
        {isActive ? (
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={onStop}
            aria-label={`Stop ${agent.name} agent`}
          >
            <Square className="h-4 w-4 mr-2" aria-hidden="true" />
            Stop Agent
          </Button>
        ) : (
          <Button
            variant={isRecommended ? "default" : "outline"}
            size="sm"
            className="w-full"
            onClick={onSelect}
            disabled={agent.status === 'starting'}
            aria-label={`Start ${agent.name} agent`}
          >
            <Play className="h-4 w-4 mr-2" aria-hidden="true" />
            Start Agent
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentSelectorPanel({
  taskDescription,
  onAgentSelect,
  onAgentStop,
  activeAgents = [],
  className,
  enableKeyboardShortcuts = true
}: AgentSelectorPanelProps) {
  const [agents, setAgents] = useState<AgentDefinition[]>(AGENT_DEFINITIONS)
  const recommendedAgentId = taskDescription ? getRecommendedAgent(taskDescription) : null

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboardShortcuts) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      if (!(event.metaKey || event.ctrlKey)) return

      const key = event.key
      const agentIndex = parseInt(key, 10) - 1

      if (agentIndex >= 0 && agentIndex < agents.length) {
        event.preventDefault()
        const agent = agents[agentIndex]

        if (activeAgents.includes(agent.id)) {
          onAgentStop?.(agent.id)
        } else {
          onAgentSelect(agent.id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [agents, activeAgents, enableKeyboardShortcuts, onAgentSelect, onAgentStop])

  const handleAgentSelect = useCallback((agentId: string) => {
    // Update status to starting
    setAgents(prev => prev.map(agent =>
      agent.id === agentId ? { ...agent, status: 'starting' as const } : agent
    ))

    // Call parent callback
    onAgentSelect(agentId)
  }, [onAgentSelect])

  const handleAgentStop = useCallback((agentId: string) => {
    // Update status to stopped
    setAgents(prev => prev.map(agent =>
      agent.id === agentId ? { ...agent, status: 'ready' as const } : agent
    ))

    // Call parent callback
    onAgentStop?.(agentId)
  }, [onAgentStop])

  return (
    <div className={cn("w-full", className)} role="region" aria-label="Agent selection panel">
      {/* Recommendation Banner */}
      {recommendedAgentId && (
        <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-sm">Smart Recommendation</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Based on your task, we recommend using{' '}
                <span className="font-medium text-foreground">
                  {agents.find(a => a.id === recommendedAgentId)?.name}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Agent Grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        role="list"
        aria-label="Available agents"
      >
        {agents.map((agent) => (
          <div key={agent.id} role="listitem">
            <AgentCard
              agent={agent}
              isRecommended={agent.id === recommendedAgentId}
              isActive={activeAgents.includes(agent.id)}
              onSelect={() => handleAgentSelect(agent.id)}
              onStop={() => handleAgentStop(agent.id)}
            />
          </div>
        ))}
      </div>

      {/* Keyboard Shortcuts Help */}
      {enableKeyboardShortcuts && (
        <div className="mt-6 p-3 bg-muted/50 rounded-md">
          <p className="text-xs text-muted-foreground text-center">
            <kbd className="px-1 py-0.5 bg-background rounded border text-xs">⌘</kbd> +
            <kbd className="px-1 py-0.5 bg-background rounded border text-xs ml-1">1-6</kbd>
            {' '}to quickly select agents
          </p>
        </div>
      )}
    </div>
  )
}
