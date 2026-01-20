/**
 * AgentMonitoringDashboard Component
 *
 * Real-time monitoring dashboard for agent performance,
 * resource usage, and health metrics.
 *
 * Features:
 * - Real-time metrics visualization
 * - Resource usage tracking (CPU, memory, tokens)
 * - Agent health status
 * - Performance analytics
 * - Error rate monitoring
 * - Cost tracking
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * @module components/agents/AgentMonitoringDashboard
 */

'use client'

import React, { useState, useMemo } from 'react'
import {
  Activity,
  Cpu,
  MemoryStick,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,

  BarChart,
  RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
// import { logger } from '@/lib/logger';

// ============================================================================
// Type Definitions
// ============================================================================

export interface AgentMetrics {
  agentId: string
  agentName: string
  status: 'healthy' | 'warning' | 'error' | 'offline'
  uptime: number
  requestCount: number
  errorCount: number
  averageResponseTime: number
  resources: {
    cpuUsage: number
    memoryUsage: number
    tokenUsage: number
  }
  costs: {
    inputTokens: number
    outputTokens: number
    totalCost: number
  }
  lastActivity: Date
}

export interface SystemMetrics {
  totalAgents: number
  activeAgents: number
  totalRequests: number
  totalErrors: number
  averageResponseTime: number
  totalTokenUsage: number
  totalCost: number
}

export interface AgentMonitoringDashboardProps {
  /** Individual agent metrics */
  agentMetrics: AgentMetrics[]
  /** System-wide metrics */
  systemMetrics: SystemMetrics
  /** Callback to refresh metrics */
  onRefresh?: () => Promise<void>
  /** Auto-refresh interval in ms */
  refreshInterval?: number
  /** Custom className */
  className?: string
}

// ============================================================================
// Metric Card Component
// ============================================================================

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ElementType
  iconColor?: string
  description?: string
}

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  iconColor = 'text-primary',
  description
}: MetricCardProps) {
  const hasPositiveChange = change !== undefined && change > 0
  const hasNegativeChange = change !== undefined && change < 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", iconColor)} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {change !== undefined && (
          <div className="flex items-center gap-1 mt-1 text-xs">
            {hasPositiveChange ? (
              <TrendingUp className="h-3 w-3 text-green-500" aria-hidden="true" />
            ) : hasNegativeChange ? (
              <TrendingDown className="h-3 w-3 text-red-500" aria-hidden="true" />
            ) : null}
            <span
              className={cn(
                hasPositiveChange && "text-green-500",
                hasNegativeChange && "text-red-500"
              )}
            >
              {change > 0 ? '+' : ''}
              {change.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">from last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Agent Status Card Component
// ============================================================================

interface AgentStatusCardProps {
  metrics: AgentMetrics
}

function AgentStatusCard({ metrics }: AgentStatusCardProps) {
  const statusConfig = {
    healthy: {
      color: 'bg-green-500/10 text-green-500 border-green-500/20',
      icon: CheckCircle
    },
    warning: {
      color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      icon: AlertCircle
    },
    error: {
      color: 'bg-red-500/10 text-red-500 border-red-500/20',
      icon: AlertCircle
    },
    offline: {
      color: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      icon: Activity
    }
  }

  const config = statusConfig[metrics.status]
  const StatusIcon = config.icon
  const errorRate = metrics.requestCount > 0
    ? (metrics.errorCount / metrics.requestCount) * 100
    : 0

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{metrics.agentName}</CardTitle>
          <Badge
            variant="outline"
            className={cn("flex items-center gap-1 border", config.color)}
          >
            <StatusIcon className="h-3 w-3" aria-hidden="true" />
            {metrics.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resource Usage */}
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                <Cpu className="h-3 w-3" aria-hidden="true" />
                CPU
              </span>
              <span className="font-medium">{metrics.resources.cpuUsage}%</span>
            </div>
            <Progress
              value={metrics.resources.cpuUsage}
              className="h-1"
              aria-label={`CPU usage: ${metrics.resources.cpuUsage}%`}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                <MemoryStick className="h-3 w-3" aria-hidden="true" />
                Memory
              </span>
              <span className="font-medium">{metrics.resources.memoryUsage}%</span>
            </div>
            <Progress
              value={metrics.resources.memoryUsage}
              className="h-1"
              aria-label={`Memory usage: ${metrics.resources.memoryUsage}%`}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t text-xs">
          <div>
            <div className="text-muted-foreground mb-1">Uptime</div>
            <div className="font-medium">{formatUptime(metrics.uptime)}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Requests</div>
            <div className="font-medium">{metrics.requestCount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Avg Response</div>
            <div className="font-medium">{metrics.averageResponseTime}ms</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Error Rate</div>
            <div className={cn(
              "font-medium",
              errorRate > 5 && "text-red-500",
              errorRate > 1 && errorRate <= 5 && "text-yellow-500",
              errorRate <= 1 && "text-green-500"
            )}>
              {errorRate.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Token Usage */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">Token Usage</span>
            <span className="font-medium">
              {metrics.resources.tokenUsage.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Cost</span>
            <span className="font-medium">${metrics.costs.totalCost.toFixed(4)}</span>
          </div>
        </div>

        {/* Last Activity */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-3 border-t">
          <Clock className="h-3 w-3" aria-hidden="true" />
          <span>Last active {new Date(metrics.lastActivity).toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentMonitoringDashboard({
  agentMetrics,
  systemMetrics,
  onRefresh,
  refreshInterval = 30000,
  className
}: AgentMonitoringDashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const handleRefresh = async () => {
    if (!onRefresh) return

    setIsRefreshing(true)
    try {
      await onRefresh()
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Failed to refresh metrics:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Auto-refresh
  React.useEffect(() => {
    if (!onRefresh || !refreshInterval) return

    const interval = setInterval(() => {
      handleRefresh()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [onRefresh, refreshInterval])

  const healthyAgents = agentMetrics.filter(m => m.status === 'healthy').length
  const warningAgents = agentMetrics.filter(m => m.status === 'warning').length
  const errorAgents = agentMetrics.filter(m => m.status === 'error').length

  const avgErrorRate = systemMetrics.totalRequests > 0
    ? (systemMetrics.totalErrors / systemMetrics.totalRequests) * 100
    : 0

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" aria-hidden="true" />
            Agent Monitoring
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time performance and health metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh metrics"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Agents"
          value={`${systemMetrics.activeAgents} / ${systemMetrics.totalAgents}`}
          icon={Activity}
          iconColor="text-blue-500"
          description={`${healthyAgents} healthy, ${warningAgents} warning, ${errorAgents} error`}
        />
        <MetricCard
          title="Total Requests"
          value={systemMetrics.totalRequests.toLocaleString()}
          icon={BarChart}
          iconColor="text-green-500"
          description={`${avgErrorRate.toFixed(1)}% error rate`}
        />
        <MetricCard
          title="Avg Response Time"
          value={`${systemMetrics.averageResponseTime}ms`}
          icon={Clock}
          iconColor="text-purple-500"
        />
        <MetricCard
          title="Total Cost"
          value={`$${systemMetrics.totalCost.toFixed(2)}`}
          icon={TrendingUp}
          iconColor="text-yellow-500"
          description={`${systemMetrics.totalTokenUsage.toLocaleString()} tokens`}
        />
      </div>

      {/* Agents Details */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">
            All Agents ({agentMetrics.length})
          </TabsTrigger>
          <TabsTrigger value="healthy">
            Healthy ({healthyAgents})
          </TabsTrigger>
          <TabsTrigger value="issues">
            Issues ({warningAgents + errorAgents})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <ScrollArea className="h-[600px]">
            {agentMetrics.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  No agents are currently being monitored
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                {agentMetrics.map((metrics) => (
                  <AgentStatusCard key={metrics.agentId} metrics={metrics} />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="healthy" className="mt-4">
          <ScrollArea className="h-[600px]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
              {agentMetrics
                .filter(m => m.status === 'healthy')
                .map((metrics) => (
                  <AgentStatusCard key={metrics.agentId} metrics={metrics} />
                ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="issues" className="mt-4">
          <ScrollArea className="h-[600px]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
              {agentMetrics
                .filter(m => m.status === 'warning' || m.status === 'error')
                .map((metrics) => (
                  <AgentStatusCard key={metrics.agentId} metrics={metrics} />
                ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
