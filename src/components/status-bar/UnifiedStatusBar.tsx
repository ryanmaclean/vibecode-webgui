/**
 * Unified Status Bar Component
 *
 * Fixed bottom status bar showing real-time health status for all integrated services.
 * Features:
 * - Collapsible panel with overview and detailed views
 * - Real-time updates via WebSocket with polling fallback
 * - Connection status indicator
 * - Keyboard shortcuts support
 * - Responsive design
 * - Auto-expand on unhealthy services
 *
 * Services monitored:
 * - Infrastructure: Docker, Kubernetes, SSH
 * - Database: PostgreSQL, pgvector, Valkey
 * - AI Providers: OpenAI, Anthropic, Azure OpenAI
 * - Monitoring: Datadog, OpenTelemetry
 * - Development: OpenVSCode
 *
 * @module components/status-bar/UnifiedStatusBar
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import {
  ChevronUp,
  ChevronDown,
  Activity,
  AlertCircle,
  CheckCircle,
  WifiOff,
  Wifi,
} from 'lucide-react';
import { CollapsibleStatusPanel } from './CollapsibleStatusPanel';
import { ServiceStatusIndicator } from './ServiceStatusIndicator';
import type {
  UnifiedHealthResponse,
  StatusBarPreferences,
  DEFAULT_STATUS_BAR_PREFERENCES,
  CategorizedServiceHealth,
} from '@/types/unified-status';
import type { AggregatedHealthStatus, ServiceHealthStatus } from '@/types/health';
import type { StatusMessage } from '@/types/status-events';

const POLL_INTERVAL_MS = 30000; // 30 seconds for unified health
const WS_RECONNECT_BASE_MS = 1000;
const WS_RECONNECT_MAX_MS = 30000;

type WsConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

/**
 * Props for UnifiedStatusBar component
 */
export interface UnifiedStatusBarProps {
  /** Initial collapsed state */
  initialCollapsed?: boolean;
  /** Auto-expand on unhealthy services */
  autoExpandOnUnhealthy?: boolean;
  /** Show detailed metrics */
  showDetailedMetrics?: boolean;
  /** Additional class name */
  className?: string;
  /** Disable WebSocket (use polling only) */
  disableWebSocket?: boolean;
  /** Custom polling interval in milliseconds */
  pollingInterval?: number;
}

/**
 * Get status icon component with accessibility
 */
function getOverallStatusIcon(status: AggregatedHealthStatus, t: (key: string) => string) {
  const getStatusLabel = () => {
    switch (status) {
      case 'healthy':
        return t('statusBar.overallStatus.allSystemsOperational');
      case 'degraded':
        return t('statusBar.overallStatus.someSystemsDegraded');
      case 'unhealthy':
        return t('statusBar.overallStatus.systemIssuesDetected');
      default:
        return t('statusBar.overallStatus.statusUnknown');
    }
  };

  switch (status) {
    case 'healthy':
      return <CheckCircle className="w-4 h-4 text-green-600" aria-label={getStatusLabel()} />;
    case 'degraded':
      return <AlertCircle className="w-4 h-4 text-yellow-600" aria-label={getStatusLabel()} />;
    case 'unhealthy':
      return <AlertCircle className="w-4 h-4 text-red-600" aria-label={getStatusLabel()} />;
    default:
      return <Activity className="w-4 h-4 text-muted-foreground animate-pulse" aria-label={getStatusLabel()} />;
  }
}

/**
 * Get status badge variant with WCAG AA compliant colors
 */
function getStatusBadgeColor(status: AggregatedHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-green-600 text-white hover:bg-green-700';
    case 'degraded':
      return 'bg-yellow-600 text-white hover:bg-yellow-700';
    case 'unhealthy':
      return 'bg-red-600 text-white hover:bg-red-700';
    default:
      return 'bg-gray-500 text-white';
  }
}

/**
 * Get connection status indicator with accessibility
 */
function ConnectionStatusIndicator({ status, t }: { status: WsConnectionStatus; t: (key: string) => string }) {
  const isConnected = status === 'connected';
  const isReconnecting = status === 'reconnecting';

  const getStatusText = () => {
    if (isConnected) return t('statusBar.connection.liveUpdatesEnabled');
    if (isReconnecting) return t('statusBar.connection.reconnecting');
    return t('statusBar.connection.usingPolling');
  };

  return (
    <Tooltip content={getStatusText()}>
      <div
        className="flex items-center gap-1.5"
        role="status"
        aria-live="polite"
        aria-label={getStatusText()}
      >
        {isConnected ? (
          <Wifi className="w-3.5 h-3.5 text-green-600" aria-hidden="true" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
        )}
        <div
          className={cn(
            'w-2 h-2 rounded-full',
            isConnected && 'bg-green-600 animate-pulse',
            isReconnecting && 'bg-yellow-600 animate-pulse',
            !isConnected && !isReconnecting && 'bg-gray-500'
          )}
          aria-hidden="true"
        />
      </div>
    </Tooltip>
  );
}

/**
 * UnifiedStatusBar Component
 * Main status bar with collapse/expand functionality and real-time updates
 */
export const UnifiedStatusBar = React.memo(function UnifiedStatusBar({
  initialCollapsed = true,
  autoExpandOnUnhealthy = true,
  showDetailedMetrics = false,
  className,
  disableWebSocket = false,
  pollingInterval = POLL_INTERVAL_MS,
}: UnifiedStatusBarProps) {
  const t = useTranslations();
  const [healthData, setHealthData] = React.useState<UnifiedHealthResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isExpanded, setIsExpanded] = React.useState(!initialCollapsed);
  const [wsStatus, setWsStatus] = React.useState<WsConnectionStatus>('disconnected');

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = React.useRef(0);
  const usingWebSocketRef = React.useRef(false);
  const mountedRef = React.useRef(true);

  /**
   * Fetch unified health data via REST API
   */
  const fetchHealth = React.useCallback(async () => {
    try {
      const res = await fetch('/api/health/unified');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();

      if (mountedRef.current) {
        setHealthData(data as UnifiedHealthResponse);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch health data');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Start polling for health updates
   */
  const startPolling = React.useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(fetchHealth, pollingInterval);
  }, [fetchHealth, pollingInterval]);

  /**
   * Stop polling for health updates
   */
  const stopPolling = React.useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Convert WebSocket status message to UnifiedHealthResponse
   */
  const convertWsStatusToHealth = React.useCallback((msg: StatusMessage): UnifiedHealthResponse | null => {
    // For now, we'll just trigger a fetch when we receive a WebSocket message
    // In the future, the WebSocket can send full unified health data
    if (msg.type === 'health_update' || msg.type === 'initial_status') {
      fetchHealth();
      return null;
    }
    return null;
  }, [fetchHealth]);

  /**
   * Connect to WebSocket for real-time updates
   */
  const connectWebSocket = React.useCallback(() => {
    if (disableWebSocket) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/status`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current) {
        setWsStatus('connected');
        reconnectAttemptRef.current = 0;
        usingWebSocketRef.current = true;
        stopPolling();
      }
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;

      try {
        const msg: StatusMessage = JSON.parse(event.data);
        convertWsStatusToHealth(msg);
      } catch {
        // Ignore unparseable messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;

      wsRef.current = null;
      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(WS_RECONNECT_BASE_MS * Math.pow(2, attempt), WS_RECONNECT_MAX_MS);
      setWsStatus('reconnecting');

      // Fall back to polling while reconnecting
      if (usingWebSocketRef.current) {
        startPolling();
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          reconnectAttemptRef.current++;
          connectWebSocket();
        }
      }, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, which handles reconnect
    };
  }, [disableWebSocket, stopPolling, startPolling, convertWsStatusToHealth]);

  /**
   * Initialize health monitoring
   */
  React.useEffect(() => {
    mountedRef.current = true;
    fetchHealth();

    if (!disableWebSocket) {
      connectWebSocket();
    } else {
      startPolling();
    }

    return () => {
      mountedRef.current = false;
      stopPolling();
      if (wsRef.current) {
        usingWebSocketRef.current = false;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchHealth, startPolling, stopPolling, connectWebSocket, disableWebSocket]);

  /**
   * Auto-expand on unhealthy status
   */
  React.useEffect(() => {
    if (
      autoExpandOnUnhealthy &&
      healthData &&
      !isExpanded &&
      (healthData.status === 'unhealthy' || healthData.status === 'degraded')
    ) {
      setIsExpanded(true);
    }
  }, [autoExpandOnUnhealthy, healthData, isExpanded]);

  /**
   * Toggle expansion state
   */
  const handleToggle = React.useCallback(() => {
    setIsExpanded((prev: boolean) => !prev);
  }, []);

  /**
   * Handle keyboard shortcuts
   */
  React.useEffect(() => {
    const handleKeyDown = (e: Event) => {
      const event = e as KeyboardEvent;
      // Ctrl/Cmd + Shift + H to toggle status bar
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'H') {
        event.preventDefault();
        handleToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggle]);

  // Extract top-level service statuses for compact view
  const topServices = React.useMemo(() => {
    if (!healthData || healthData.categories.length === 0) return [];

    // Show up to 5 services in compact view
    const services: Array<{ name: string; status: AggregatedHealthStatus | ServiceHealthStatus }> = [];

    healthData.categories.forEach((category: CategorizedServiceHealth) => {
      category.services.slice(0, 2).forEach((service) => {
        if ('name' in service && service.name && services.length < 5) {
          services.push({
            name: service.name,
            status: service.status,
          });
        }
      });
    });

    return services;
  }, [healthData]);

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300',
        isExpanded ? 'h-auto max-h-[70vh] sm:max-h-[60vh]' : 'h-12 sm:h-14',
        className
      )}
      role="region"
      aria-label={t('statusBar.ariaRegionLabel')}
      aria-live="polite"
    >
      {/* Compact status bar header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 sm:px-4 md:px-6 h-12 sm:h-14 cursor-pointer hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isExpanded && 'border-b'
        )}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${t('statusBar.healthLabel')}: ${isExpanded ? t('statusBar.collapseStatusBar') : t('statusBar.expandStatusBar')}. Press Ctrl+Shift+H to toggle. Current status: ${healthData?.summary.healthyServices || 0} of ${healthData?.summary.totalServices || 0} services healthy.`}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
          // Escape key to collapse
          if (e.key === 'Escape' && isExpanded) {
            e.preventDefault();
            setIsExpanded(false);
          }
        }}
      >
        {/* Left section: Overall status */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 sm:h-8 sm:w-8 p-0 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              handleToggle();
            }}
            aria-label={isExpanded ? t('statusBar.collapseStatusBar') : t('statusBar.expandStatusBar')}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>

          <div className="flex-shrink-0" aria-hidden="true">
            {getOverallStatusIcon(healthData?.status || 'healthy', t)}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-medium truncate">{t('statusBar.serviceHealth')}</span>
            {healthData && (
              <Badge
                className={cn(
                  'text-xs font-semibold flex-shrink-0',
                  getStatusBadgeColor(healthData.status)
                )}
                aria-label={t('statusBar.healthyServicesCount').replace('{healthy}', String(healthData.summary.healthyServices)).replace('{total}', String(healthData.summary.totalServices))}
              >
                {healthData.summary.healthyServices}/{healthData.summary.totalServices}
              </Badge>
            )}
          </div>

          {/* Compact service indicators - hidden on mobile, visible on tablet+ */}
          {!isExpanded && topServices.length > 0 && (
            <div className="hidden lg:flex items-center gap-1 ml-2 xl:ml-4">
              {topServices.map((service) => (
                <ServiceStatusIndicator
                  key={service.name}
                  serviceName={service.name}
                  status={service.status}
                  compact={true}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right section: Connection status and metadata */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0">
          {error && (
            <Tooltip content={error}>
              <div role="alert" aria-live="assertive">
                <AlertCircle className="w-4 h-4 text-destructive" aria-label={`Error: ${error}`} />
              </div>
            </Tooltip>
          )}

          {!disableWebSocket && <ConnectionStatusIndicator status={wsStatus} t={t} />}

          {healthData && (
            <span className="text-xs text-muted-foreground hidden sm:block" aria-live="off">
              <span className="sr-only">{t('statusBar.lastUpdated')}</span>
              {new Date(healthData.timestamp).toLocaleTimeString()}
            </span>
          )}

          {loading && (
            <div role="status" aria-label={t('statusBar.loadingHealth')}>
              <Activity className="w-4 h-4 text-muted-foreground animate-pulse" aria-hidden="true" />
              <span className="sr-only">{t('common.loading')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div
          className="overflow-y-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4"
          style={{ maxHeight: 'calc(70vh - 3rem)' }}
          role="region"
          aria-label={t('statusBar.detailedHealthLabel')}
        >
          <CollapsibleStatusPanel
            healthData={healthData}
            isExpanded={true}
            showDetailedMetrics={showDetailedMetrics}
            autoExpandOnUnhealthy={autoExpandOnUnhealthy}
            maxHeight="none"
          />
        </div>
      )}
    </div>
  );
});

UnifiedStatusBar.displayName = 'UnifiedStatusBar';

export default UnifiedStatusBar;
