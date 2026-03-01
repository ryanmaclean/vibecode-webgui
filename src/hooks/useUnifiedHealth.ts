/**
 * React Hook for Unified Multi-Service Health Monitoring
 *
 * Aggregates health data from all service endpoints with real-time WebSocket updates
 * and polling fallback. Monitors:
 * - Infrastructure: SSH, Docker, Kubernetes
 * - Database: PostgreSQL, Valkey, pgvector
 * - AI Providers: OpenAI, Anthropic, Azure OpenAI
 * - Monitoring: Datadog, OpenTelemetry
 * - Development: OpenVSCode
 *
 * Features:
 * - WebSocket real-time updates with automatic reconnection
 * - Polling fallback when WebSocket unavailable
 * - Connection status tracking (connected/reconnecting/disconnected)
 * - Automatic health data refresh
 * - Error handling with graceful degradation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  UnifiedHealthResponse,
  UnifiedServiceHealthResult,
  CategorizedServiceHealth,
} from '@/types/unified-status';
import type { StatusMessage, ServiceHealth } from '@/types/status-events';
import type { AggregatedHealthStatus } from '@/types/health';

const POLL_INTERVAL_MS = 5000;
const WS_RECONNECT_BASE_MS = 1000;
const WS_RECONNECT_MAX_MS = 30000;

type WsConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface UseUnifiedHealthOptions {
  /** Enable WebSocket real-time updates (default: true) */
  useWebSocket?: boolean;
  /** Polling interval in milliseconds (default: 5000) */
  pollInterval?: number;
  /** Enable automatic polling (default: true) */
  enablePolling?: boolean;
  /** Callback when connection status changes */
  onConnectionChange?: (status: WsConnectionStatus) => void;
  /** Callback when health data updates */
  onHealthUpdate?: (health: UnifiedHealthResponse) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * Custom hook for unified multi-service health monitoring
 *
 * @param options - Configuration options
 * @returns Health data, loading state, error state, and helper functions
 */
export function useUnifiedHealth(options: UseUnifiedHealthOptions = {}) {
  const {
    useWebSocket = true,
    pollInterval = POLL_INTERVAL_MS,
    enablePolling = true,
    onConnectionChange,
    onHealthUpdate,
    onError,
  } = options;

  const [healthData, setHealthData] = useState<UnifiedHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsConnectionStatus>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const usingWebSocketRef = useRef(false);

  /**
   * Fetch health data from API endpoint
   */
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health/unified');
      if (!res.ok && res.status !== 207 && res.status !== 503) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const healthResponse = data as UnifiedHealthResponse;

      setHealthData(healthResponse);
      setError(null);
      setLastUpdate(healthResponse.timestamp);
      onHealthUpdate?.(healthResponse);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch health data';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [onHealthUpdate, onError]);

  /**
   * Convert WebSocket service health data to UnifiedHealthResponse format
   */
  const convertWsServices = useCallback(
    (wsServices: ServiceHealth[], overallStatus: string): UnifiedHealthResponse => {
      // Group services by category
      const servicesByCategory = new Map<string, UnifiedServiceHealthResult[]>();

      // For now, create a simplified response structure
      // In a real implementation, this would properly map WebSocket service data
      // to the categorized format
      const categories: CategorizedServiceHealth[] = [];

      const timestamp = new Date().toISOString();

      return {
        status: overallStatus as AggregatedHealthStatus,
        timestamp,
        totalCheckTimeMs: 0,
        categories,
        summary: {
          totalServices: wsServices.length,
          healthyServices: wsServices.filter((s) => s.status === 'healthy').length,
          degradedServices: wsServices.filter((s) => s.status === 'degraded').length,
          unhealthyServices: wsServices.filter((s) => s.status === 'unhealthy').length,
          unknownServices: wsServices.filter((s) => s.status === 'unknown').length,
        },
        fromCache: false,
      };
    },
    []
  );

  /**
   * Start polling for health updates
   */
  const startPolling = useCallback(() => {
    if (!enablePolling || intervalRef.current) return;
    intervalRef.current = setInterval(fetchHealth, pollInterval);
  }, [fetchHealth, pollInterval, enablePolling]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Update WebSocket connection status
   */
  const updateWsStatus = useCallback(
    (status: WsConnectionStatus) => {
      setWsStatus(status);
      onConnectionChange?.(status);
    },
    [onConnectionChange]
  );

  /**
   * Connect to WebSocket for real-time updates
   */
  const connectWebSocket = useCallback(() => {
    if (!useWebSocket || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/status`);
    wsRef.current = ws;

    ws.onopen = () => {
      updateWsStatus('connected');
      reconnectAttemptRef.current = 0;
      usingWebSocketRef.current = true;
      stopPolling();
    };

    ws.onmessage = (event) => {
      try {
        const msg: StatusMessage = JSON.parse(event.data);

        if (msg.type === 'health_update') {
          const data = convertWsServices(msg.payload.services, msg.payload.overallStatus);
          setHealthData(data);
          setError(null);
          setLoading(false);
          setLastUpdate(data.timestamp);
          onHealthUpdate?.(data);
        } else if (msg.type === 'initial_status') {
          const data = convertWsServices(msg.payload.services, msg.payload.overallStatus);
          setHealthData(data);
          setError(null);
          setLoading(false);
          setLastUpdate(data.timestamp);
          onHealthUpdate?.(data);
        }
      } catch (err) {
        // Ignore unparseable messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(WS_RECONNECT_BASE_MS * Math.pow(2, attempt), WS_RECONNECT_MAX_MS);
      updateWsStatus('reconnecting');

      // Fall back to polling while reconnecting
      if (usingWebSocketRef.current && enablePolling) {
        startPolling();
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttemptRef.current++;
        connectWebSocket();
      }, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, which handles reconnect
    };
  }, [
    useWebSocket,
    enablePolling,
    convertWsServices,
    startPolling,
    stopPolling,
    updateWsStatus,
    onHealthUpdate,
  ]);

  /**
   * Manually refresh health data
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchHealth();
  }, [fetchHealth]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      usingWebSocketRef.current = false;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    updateWsStatus('disconnected');
  }, [updateWsStatus]);

  /**
   * Initialize health monitoring on mount
   */
  useEffect(() => {
    // Initial fetch
    fetchHealth();

    // Start polling if enabled and WebSocket is disabled
    if (enablePolling && !useWebSocket) {
      startPolling();
    }

    // Connect WebSocket if enabled
    if (useWebSocket) {
      connectWebSocket();
    }

    // Cleanup on unmount
    return () => {
      stopPolling();
      disconnect();
    };
  }, [fetchHealth, startPolling, stopPolling, connectWebSocket, disconnect, enablePolling, useWebSocket]);

  return {
    // State
    healthData,
    loading,
    error,
    wsStatus,
    lastUpdate,
    isConnected: wsStatus === 'connected',
    isReconnecting: wsStatus === 'reconnecting',

    // Actions
    refresh,
    clearError,
    disconnect,

    // Computed values
    overallStatus: healthData?.status ?? 'unknown',
    summary: healthData?.summary ?? {
      totalServices: 0,
      healthyServices: 0,
      degradedServices: 0,
      unhealthyServices: 0,
      unknownServices: 0,
    },
    categories: healthData?.categories ?? [],
  };
}

/**
 * Hook for monitoring a specific service category
 */
export function useCategoryHealth(category: string) {
  const { healthData, loading, error, refresh } = useUnifiedHealth();

  const categoryHealth = healthData?.categories.find((c: CategorizedServiceHealth) => c.category === category);

  return {
    categoryHealth,
    loading,
    error,
    refresh,
    status: categoryHealth?.status ?? 'unknown',
    services: categoryHealth?.services ?? [],
  };
}

/**
 * Hook for getting overall health summary
 */
export function useHealthSummary() {
  const { healthData, loading, error, overallStatus, summary, lastUpdate } = useUnifiedHealth();

  return {
    overallStatus,
    summary,
    loading,
    error,
    lastUpdate,
    hasUnhealthyServices: summary.unhealthyServices > 0,
    hasDegradedServices: summary.degradedServices > 0,
    isFullyHealthy: summary.healthyServices === summary.totalServices && summary.totalServices > 0,
  };
}
