'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTailscale } from '@/hooks/useTailscale';

/**
 * Props for TailscaleStatus component
 */
export interface TailscaleStatusProps {
  /** Auto-refresh status periodically */
  autoRefresh?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Show refresh button */
  showRefreshButton?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Status badge variant mapping
 */
const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  connected: 'default',
  disconnected: 'secondary',
  checking: 'outline',
  error: 'destructive',
};

/**
 * Status display text
 */
const statusText: Record<string, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  checking: 'Checking...',
  error: 'Error',
};

/**
 * Get connection status string
 */
function getConnectionStatus(connected: boolean, isLoading: boolean, error: string | null): string {
  if (error) return 'error';
  if (isLoading) return 'checking';
  return connected ? 'connected' : 'disconnected';
}

/**
 * TailscaleStatus Component
 * Displays Tailscale connection status and network information
 */
export const TailscaleStatus = React.memo(function TailscaleStatus({
  autoRefresh = true,
  refreshInterval = 10000,
  showRefreshButton = true,
  className
}: TailscaleStatusProps) {
  const {
    status,
    installed,
    ip,
    isLoading,
    error,
    connected,
    refreshStatus,
    checkInstallation,
  } = useTailscale({
    autoRefresh,
    refreshInterval,
  });

  const connectionStatus = getConnectionStatus(connected, isLoading, error);
  const isConnected = connectionStatus === 'connected';
  const hasError = connectionStatus === 'error';

  const handleRefresh = React.useCallback(() => {
    checkInstallation();
    refreshStatus();
  }, [checkInstallation, refreshStatus]);

  // Initial check on mount
  React.useEffect(() => {
    handleRefresh();
  }, []);

  return (
    <Card
      className={cn(
        'relative transition-shadow hover:shadow-md',
        hasError && 'border-destructive',
        className
      )}
    >
      {/* Status indicator dot */}
      <div
        className={cn(
          'absolute top-4 right-4 w-3 h-3 rounded-full',
          isConnected && 'bg-green-500 animate-pulse',
          connectionStatus === 'disconnected' && 'bg-gray-400',
          connectionStatus === 'checking' && 'bg-yellow-500 animate-pulse',
          hasError && 'bg-red-500'
        )}
      />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between pr-6">
          <CardTitle className="text-lg font-semibold">Tailscale Status</CardTitle>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={statusVariants[connectionStatus] || 'secondary'}>
            {statusText[connectionStatus] || connectionStatus}
          </Badge>
          {!installed && (
            <Badge variant="outline" className="text-xs">
              Not Installed
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Installation Status */}
        {!installed && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-yellow-800 dark:text-yellow-200">
            Tailscale is not installed on this system.
          </div>
        )}

        {/* Error Message */}
        {hasError && error && (
          <div className="p-3 bg-destructive/10 rounded text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Connection Details */}
        {installed && status && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Connection Details</h4>
            <div className="space-y-1 text-sm">
              {status.ip && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IP Address:</span>
                  <span className="font-mono">{status.ip}</span>
                </div>
              )}
              {ip && ip !== status.ip && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current IP:</span>
                  <span className="font-mono">{ip}</span>
                </div>
              )}
              {status.hostname && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hostname:</span>
                  <span className="font-mono">{status.hostname}</span>
                </div>
              )}
              {status.user && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User:</span>
                  <span>{status.user}</span>
                </div>
              )}
              {status.version && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="text-xs">{status.version}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No Status Available */}
        {installed && !status && !isLoading && !error && (
          <div className="text-sm text-muted-foreground">
            No status information available. Click refresh to check.
          </div>
        )}

        {/* Refresh Button */}
        {showRefreshButton && (
          <div className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Checking...' : 'Refresh Status'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

TailscaleStatus.displayName = 'TailscaleStatus';
