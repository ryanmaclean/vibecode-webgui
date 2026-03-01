/**
 * Collapsible Status Panel Component
 *
 * Expandable panel showing detailed service health information grouped by category.
 * Features:
 * - Category-based grouping (Infrastructure, Database, AI Providers, Monitoring, Development)
 * - Collapsible sections per category
 * - Service status indicators with detailed metrics
 * - Auto-expand on unhealthy services
 * - Responsive design
 *
 * @module components/status-bar/CollapsibleStatusPanel
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle, Activity } from 'lucide-react';
import { ServiceStatusIndicator } from './ServiceStatusIndicator';
import type {
  CategorizedServiceHealth,
  UnifiedHealthResponse,
  ServiceCategory,
  UnifiedServiceHealthResult,
} from '@/types/unified-status';
import type { AggregatedHealthStatus, ServiceHealthStatus } from '@/types/health';

/**
 * Props for CollapsibleStatusPanel component
 */
export interface CollapsibleStatusPanelProps {
  /** Unified health data to display */
  healthData: UnifiedHealthResponse | null;
  /** Whether the panel is expanded */
  isExpanded?: boolean;
  /** Callback when panel expansion changes */
  onToggle?: (expanded: boolean) => void;
  /** Auto-expand when unhealthy services detected */
  autoExpandOnUnhealthy?: boolean;
  /** Show detailed metrics (latency, etc.) */
  showDetailedMetrics?: boolean;
  /** Maximum height of the panel */
  maxHeight?: string;
  /** Additional class name */
  className?: string;
}

/**
 * Get overall status icon component with accessibility
 */
function getStatusIcon(status: AggregatedHealthStatus) {
  const getStatusLabel = () => {
    switch (status) {
      case 'healthy':
        return 'All systems operational';
      case 'degraded':
        return 'Some systems degraded';
      case 'unhealthy':
        return 'System issues detected';
      default:
        return 'Status unknown';
    }
  };

  switch (status) {
    case 'healthy':
      return <CheckCircle className="w-5 h-5 text-green-600" aria-label={getStatusLabel()} />;
    case 'degraded':
      return <AlertCircle className="w-5 h-5 text-yellow-600" aria-label={getStatusLabel()} />;
    case 'unhealthy':
    default:
      return <AlertCircle className="w-5 h-5 text-red-600" aria-label={getStatusLabel()} />;
  }
}

/**
 * Get status badge variant
 */
function getStatusBadgeVariant(status: AggregatedHealthStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'healthy':
      return 'default';
    case 'degraded':
      return 'outline';
    case 'unhealthy':
    default:
      return 'destructive';
  }
}

/**
 * Extract service name from unified service result
 */
function getServiceName(service: UnifiedServiceHealthResult): string {
  if ('name' in service) {
    return service.name;
  }
  return 'unknown';
}

/**
 * Extract service status from unified service result
 */
function getServiceStatus(service: UnifiedServiceHealthResult): ServiceHealthStatus | AggregatedHealthStatus {
  return service.status;
}

/**
 * Extract latency from service result
 */
function getServiceLatency(service: UnifiedServiceHealthResult): number | undefined {
  if ('latencyMs' in service) {
    return service.latencyMs;
  }
  return undefined;
}

/**
 * Extract last checked timestamp from service result
 */
function getServiceLastChecked(service: UnifiedServiceHealthResult): string | undefined {
  if ('lastChecked' in service) {
    return service.lastChecked;
  }
  return undefined;
}

/**
 * Extract error from service result
 */
function getServiceError(service: UnifiedServiceHealthResult): string | undefined {
  if ('error' in service) {
    return service.error;
  }
  return undefined;
}

/**
 * Category Section Component
 */
interface CategorySectionProps {
  category: CategorizedServiceHealth;
  showDetailedMetrics: boolean;
  onServiceClick?: (serviceName: string) => void;
}

const CategorySection = React.memo(function CategorySection({
  category,
  showDetailedMetrics,
  onServiceClick,
}: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  // Auto-expand if category has unhealthy services
  React.useEffect(() => {
    if (category.status === 'unhealthy' || category.status === 'degraded') {
      setIsExpanded(true);
    }
  }, [category.status]);

  const healthyCount = category.services.filter((s) => s.status === 'healthy').length;
  const totalCount = category.services.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="space-y-2" role="region" aria-label={`${category.categoryName} services`}>
      <Button
        variant="ghost"
        className="w-full justify-between px-2 sm:px-3 py-2 h-auto focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-label={`${category.categoryName}: ${healthyCount} of ${totalCount} services healthy. ${isExpanded ? 'Collapse' : 'Expand'} to ${isExpanded ? 'hide' : 'show'} details.`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          )}
          <span className="font-semibold text-xs sm:text-sm truncate">{category.categoryName}</span>
          <Badge
            variant={getStatusBadgeVariant(category.status)}
            className={cn(
              'text-xs flex-shrink-0',
              category.status === 'healthy' && 'bg-green-600 text-white hover:bg-green-700',
              category.status === 'degraded' && 'bg-yellow-600 text-white hover:bg-yellow-700'
            )}
            aria-label={`${healthyCount} healthy out of ${totalCount} total`}
          >
            {healthyCount}/{totalCount}
          </Badge>
        </div>
        <div className="flex-shrink-0" aria-hidden="true">
          {getStatusIcon(category.status)}
        </div>
      </Button>

      {isExpanded && category.services.length > 0 && (
        <div
          className="ml-4 sm:ml-6 space-y-2"
          role="list"
          aria-label={`${category.categoryName} service details`}
        >
          {category.services.map((service) => {
            const serviceName = getServiceName(service);
            const status = getServiceStatus(service);
            const latency = getServiceLatency(service);
            const lastChecked = getServiceLastChecked(service);
            const error = getServiceError(service);

            return (
              <div key={serviceName} role="listitem">
                <ServiceStatusIndicator
                  serviceName={serviceName}
                  status={status}
                  latencyMs={latency}
                  lastChecked={lastChecked}
                  error={error}
                  showLatency={showDetailedMetrics}
                  compact={false}
                  onClick={onServiceClick ? () => onServiceClick(serviceName) : undefined}
                  className="border-l-2 border-border pl-2 sm:pl-3"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

CategorySection.displayName = 'CategorySection';

/**
 * CollapsibleStatusPanel Component
 * Main expandable panel for displaying detailed service health
 */
export const CollapsibleStatusPanel = React.memo(
  React.forwardRef<HTMLDivElement, CollapsibleStatusPanelProps>(function CollapsibleStatusPanel(
    {
      healthData,
      isExpanded = false,
      onToggle,
      autoExpandOnUnhealthy = true,
      showDetailedMetrics = false,
      maxHeight = '400px',
      className,
    },
    ref
  ) {
    const [expanded, setExpanded] = React.useState(isExpanded);

    // Sync with prop changes
    React.useEffect(() => {
      setExpanded(isExpanded);
    }, [isExpanded]);

    // Auto-expand on unhealthy status
    React.useEffect(() => {
      if (
        autoExpandOnUnhealthy &&
        healthData &&
        (healthData.status === 'unhealthy' || healthData.status === 'degraded')
      ) {
        setExpanded(true);
        onToggle?.(true);
      }
    }, [autoExpandOnUnhealthy, healthData, onToggle]);

    const handleToggle = React.useCallback(() => {
      const newExpanded = !expanded;
      setExpanded(newExpanded);
      onToggle?.(newExpanded);
    }, [expanded, onToggle]);

    const handleServiceClick = React.useCallback((serviceName: string) => {
      // Can be extended to show service-specific details
      console.info(`Service clicked: ${serviceName}`);
    }, []);

    if (!healthData) {
      return (
        <Card ref={ref} className={cn('w-full', className)} role="status" aria-live="polite">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Activity className="w-4 h-4 animate-pulse" aria-hidden="true" />
              <span className="text-sm">Loading health data...</span>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card
        ref={ref}
        className={cn('w-full transition-all', className)}
        role="region"
        aria-label="Detailed service health panel"
      >
        <CardHeader className="pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="flex-shrink-0" aria-hidden="true">
                {getStatusIcon(healthData.status)}
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base sm:text-lg truncate">Service Health</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="sr-only">Overall status: </span>
                  {healthData.summary.healthyServices} of {healthData.summary.totalServices} services
                  healthy
                  {healthData.fromCache && ' (cached)'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={handleToggle}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggle();
                }
              }}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} detailed service health panel`}
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronDown className="w-5 h-5" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </CardHeader>

        {expanded && (
          <>
            <Separator />
            <CardContent className="p-3 sm:p-4 md:p-6">
              <ScrollArea style={{ maxHeight }} className="pr-2 sm:pr-4">
                <div className="space-y-3 sm:space-y-4" role="region" aria-label="Service categories">
                  {healthData.categories.length === 0 ? (
                    <div
                      className="text-center text-sm text-muted-foreground py-8"
                      role="status"
                    >
                      No service health data available
                    </div>
                  ) : (
                    healthData.categories.map((category, index) => (
                      <React.Fragment key={category.category}>
                        <CategorySection
                          category={category}
                          showDetailedMetrics={showDetailedMetrics}
                          onServiceClick={handleServiceClick}
                        />
                        {index < healthData.categories.length - 1 && (
                          <Separator className="my-2" aria-hidden="true" />
                        )}
                      </React.Fragment>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Summary footer */}
              <div className="mt-4 pt-3 border-t" role="contentinfo" aria-label="Health check summary">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2 text-xs text-muted-foreground">
                  <span>
                    <span className="sr-only">Last updated: </span>
                    <span className="hidden sm:inline">Last updated: </span>
                    {new Date(healthData.timestamp).toLocaleTimeString()}
                  </span>
                  <span aria-label={`Total check time: ${healthData.totalCheckTimeMs} milliseconds`}>
                    <span className="hidden sm:inline">Check time: </span>
                    <span className="sm:hidden">Total: </span>
                    {healthData.totalCheckTimeMs}ms
                  </span>
                </div>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    );
  })
);

CollapsibleStatusPanel.displayName = 'CollapsibleStatusPanel';

export default CollapsibleStatusPanel;
