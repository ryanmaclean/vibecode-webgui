'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import type { UnifiedServiceHealthResult } from '@/types/unified-status';
import type { ServiceHealthStatus, AggregatedHealthStatus } from '@/types/health';

/**
 * Props for ServiceStatusIndicator component
 */
export interface ServiceStatusIndicatorProps {
  /** Service name to display */
  serviceName: string;
  /** Service health status */
  status: ServiceHealthStatus | AggregatedHealthStatus;
  /** Latency in milliseconds */
  latencyMs?: number;
  /** Last checked timestamp */
  lastChecked?: string;
  /** Error message if unhealthy */
  error?: string;
  /** Additional details to show in tooltip */
  details?: Record<string, unknown>;
  /** Show latency metric */
  showLatency?: boolean;
  /** Compact mode (smaller indicator) */
  compact?: boolean;
  /** Additional class name */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Status badge variant mapping
 */
const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  healthy: 'default',
  degraded: 'outline',
  unhealthy: 'destructive',
  unknown: 'secondary',
};

/**
 * Status display text
 */
const statusText: Record<string, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  unhealthy: 'Unhealthy',
  unknown: 'Unknown',
};

/**
 * Get status indicator color classes
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'bg-green-500';
    case 'degraded':
      return 'bg-yellow-500';
    case 'unhealthy':
      return 'bg-red-500';
    case 'unknown':
    default:
      return 'bg-gray-400';
  }
}

/**
 * Format latency for display
 */
function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 60000) {
      return 'just now';
    } else if (diffMs < 3600000) {
      const mins = Math.floor(diffMs / 60000);
      return `${mins}m ago`;
    } else {
      const hours = Math.floor(diffMs / 3600000);
      return `${hours}h ago`;
    }
  } catch {
    return 'unknown';
  }
}

/**
 * ServiceStatusIndicator Component
 * Displays individual service status with color-coded indicator and tooltip
 */
export const ServiceStatusIndicator = React.memo(function ServiceStatusIndicator({
  serviceName,
  status,
  latencyMs,
  lastChecked,
  error,
  details,
  showLatency = false,
  compact = false,
  className,
  onClick,
}: ServiceStatusIndicatorProps) {
  const isHealthy = status === 'healthy';
  const isDegraded = status === 'degraded';
  const isUnhealthy = status === 'unhealthy';
  const isUnknown = status === 'unknown';

  // Build tooltip content
  const tooltipContent = React.useMemo(() => {
    const parts: string[] = [`${serviceName}: ${statusText[status] || status}`];

    if (latencyMs !== undefined) {
      parts.push(`Response: ${formatLatency(latencyMs)}`);
    }

    if (lastChecked) {
      parts.push(`Checked: ${formatTimestamp(lastChecked)}`);
    }

    if (error) {
      parts.push(`Error: ${error}`);
    }

    return parts.join(' | ');
  }, [serviceName, status, latencyMs, lastChecked, error]);

  return (
    <Tooltip content={tooltipContent}>
      <div
        className={cn(
          'relative inline-flex items-center gap-2 transition-all',
          onClick && 'cursor-pointer hover:opacity-80',
          compact ? 'px-2 py-1' : 'px-3 py-2',
          className
        )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        {/* Status indicator dot */}
        <div
          className={cn(
            'rounded-full',
            compact ? 'w-2 h-2' : 'w-3 h-3',
            getStatusColor(status),
            isHealthy && 'animate-pulse',
            isDegraded && 'animate-pulse'
          )}
          aria-label={`${serviceName} status: ${status}`}
        />

        {/* Service name and status badge */}
        <div className="flex items-center gap-2">
          {!compact && (
            <span className="text-sm font-medium text-foreground">
              {serviceName}
            </span>
          )}

          {compact ? (
            <span className="text-xs text-muted-foreground">{serviceName}</span>
          ) : (
            <Badge
              variant={statusVariants[status] || 'secondary'}
              className={cn(
                'text-xs',
                isUnhealthy && 'bg-destructive text-destructive-foreground',
                isHealthy && 'bg-green-500 text-white hover:bg-green-600',
                isDegraded && 'bg-yellow-500 text-white hover:bg-yellow-600'
              )}
            >
              {statusText[status] || status}
            </Badge>
          )}

          {/* Optional latency display */}
          {showLatency && latencyMs !== undefined && !compact && (
            <span className="text-xs text-muted-foreground">
              {formatLatency(latencyMs)}
            </span>
          )}
        </div>

        {/* Error indicator */}
        {error && !compact && (
          <div
            className="w-1.5 h-1.5 rounded-full bg-red-500"
            aria-label="Service has errors"
          />
        )}
      </div>
    </Tooltip>
  );
});

ServiceStatusIndicator.displayName = 'ServiceStatusIndicator';

export default ServiceStatusIndicator;
