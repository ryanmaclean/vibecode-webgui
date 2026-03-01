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
 * Get overall status icon component
 */
function getStatusIcon(status: AggregatedHealthStatus) {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'degraded':
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    case 'unhealthy':
    default:
      return <AlertCircle className="w-5 h-5 text-red-500" />;
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

  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        className="w-full justify-between px-3 py-2 h-auto"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-sm">{category.categoryName}</span>
          <Badge
            variant={getStatusBadgeVariant(category.status)}
            className={cn(
              'text-xs',
              category.status === 'healthy' && 'bg-green-500 text-white hover:bg-green-600',
              category.status === 'degraded' && 'bg-yellow-500 text-white hover:bg-yellow-600'
            )}
          >
            {healthyCount}/{totalCount}
          </Badge>
        </div>
        {getStatusIcon(category.status)}
      </Button>

      {isExpanded && category.services.length > 0 && (
        <div className="ml-6 space-y-2">
          {category.services.map((service) => {
            const serviceName = getServiceName(service);
            const status = getServiceStatus(service);
            const latency = getServiceLatency(service);
            const lastChecked = getServiceLastChecked(service);
            const error = getServiceError(service);

            return (
              <ServiceStatusIndicator
                key={serviceName}
                serviceName={serviceName}
                status={status}
                latencyMs={latency}
                lastChecked={lastChecked}
                error={error}
                showLatency={showDetailedMetrics}
                compact={false}
                onClick={onServiceClick ? () => onServiceClick(serviceName) : undefined}
                className="border-l-2 border-border pl-3"
              />
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
        <Card ref={ref} className={cn('w-full', className)}>
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Activity className="w-4 h-4 animate-pulse" />
              <span className="text-sm">Loading health data...</span>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card ref={ref} className={cn('w-full transition-all', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(healthData.status)}
              <div>
                <CardTitle className="text-lg">Service Health</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {healthData.summary.healthyServices} of {healthData.summary.totalServices} services
                  healthy
                  {healthData.fromCache && ' (cached)'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggle}
              aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </Button>
          </div>
        </CardHeader>

        {expanded && (
          <>
            <Separator />
            <CardContent className="p-4">
              <ScrollArea style={{ maxHeight }} className="pr-4">
                <div className="space-y-4">
                  {healthData.categories.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No service health data available
                    </div>
                  ) : (
                    healthData.categories.map((category) => (
                      <React.Fragment key={category.category}>
                        <CategorySection
                          category={category}
                          showDetailedMetrics={showDetailedMetrics}
                          onServiceClick={handleServiceClick}
                        />
                        <Separator className="my-2" />
                      </React.Fragment>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Summary footer */}
              <div className="mt-4 pt-3 border-t">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Last updated: {new Date(healthData.timestamp).toLocaleTimeString()}
                  </span>
                  <span>Check time: {healthData.totalCheckTimeMs}ms</span>
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
