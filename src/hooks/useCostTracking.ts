/**
 * Cost Tracking Hook for VibeCode AI
 *
 * Provides React hooks for accessing and managing AI cost tracking data.
 * Wraps the CostTracker service with reactive state management.
 *
 * @module hooks/useCostTracking
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getCostTracker,
  CostTracker,
} from '@/lib/ai/cost/cost-tracker';
import {
  SessionUsage,
  UsageHistory,
  UsageStats,
  CostEstimate,
  CostEvent,
} from '@/types/cost-estimation';

// ============================================================================
// Hook Options
// ============================================================================

export interface UseCostTrackingOptions {
  /** Custom cost tracker instance */
  costTracker?: CostTracker;
  /** Auto-refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
  /** Enable automatic data syncing */
  enableSync?: boolean;
}

// ============================================================================
// Hook Return Type
// ============================================================================

export interface UseCostTrackingReturn {
  /** Current session usage data */
  currentSession: SessionUsage;
  /** Historical usage data across time periods */
  history: UsageHistory;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error state if any */
  error: Error | null;
  /** Get current session usage */
  getCurrentSession: () => SessionUsage;
  /** Get usage history */
  getHistory: () => UsageHistory;
  /** Record usage from an API request */
  recordUsage: (
    modelId: string,
    promptTokens: number,
    completionTokens: number,
    options?: {
      sessionId?: string;
      userId?: string;
      workspaceId?: string;
    }
  ) => UsageStats;
  /** Estimate cost for a message before sending */
  estimateCost: (
    message: string,
    modelId: string,
    estimatedOutputTokens?: number
  ) => CostEstimate;
  /** Refresh data from storage */
  refresh: () => void;
  /** Cost tracker instance for advanced usage */
  tracker: CostTracker;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for tracking and managing AI usage costs
 *
 * Provides reactive access to session usage, history data, and cost estimation.
 * Automatically syncs with local storage and updates across component renders.
 *
 * @param options - Configuration options for the hook
 * @returns Cost tracking state and methods
 *
 * @example
 * ```tsx
 * function CostDisplay() {
 *   const {
 *     currentSession,
 *     history,
 *     recordUsage,
 *     estimateCost,
 *   } = useCostTracking();
 *
 *   // Display current session cost
 *   return (
 *     <div>
 *       <p>Session Cost: ${currentSession.totalCost.toFixed(4)}</p>
 *       <p>Total Requests: {currentSession.requests}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With auto-refresh
 * function LiveCostTracker() {
 *   const { currentSession, refresh } = useCostTracking({
 *     refreshInterval: 5000, // Refresh every 5 seconds
 *   });
 *
 *   return <CostDashboard session={currentSession} />;
 * }
 * ```
 */
export function useCostTracking(
  options: UseCostTrackingOptions = {}
): UseCostTrackingReturn {
  const {
    costTracker,
    refreshInterval = 0,
    enableSync = true,
  } = options;

  // ============================================================================
  // State Management
  // ============================================================================

  const tracker = useMemo(
    () => costTracker || getCostTracker(),
    [costTracker]
  );

  const [currentSession, setCurrentSession] = useState<SessionUsage>(() =>
    tracker.getCurrentSession()
  );

  const [history, setHistory] = useState<UsageHistory>(() =>
    tracker.getUsageHistory()
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const refresh = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);

      const session = tracker.getCurrentSession();
      const usageHistory = tracker.getUsageHistory();

      setCurrentSession(session);
      setHistory(usageHistory);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh cost data'));
      console.error('Error refreshing cost tracking data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tracker]);

  // ============================================================================
  // Cost Tracker Methods
  // ============================================================================

  const getCurrentSession = useCallback((): SessionUsage => {
    const session = tracker.getCurrentSession();
    setCurrentSession(session);
    return session;
  }, [tracker]);

  const getHistory = useCallback((): UsageHistory => {
    const usageHistory = tracker.getUsageHistory();
    setHistory(usageHistory);
    return usageHistory;
  }, [tracker]);

  const recordUsage = useCallback(
    (
      modelId: string,
      promptTokens: number,
      completionTokens: number,
      recordOptions?: {
        sessionId?: string;
        userId?: string;
        workspaceId?: string;
      }
    ): UsageStats => {
      try {
        const usage = tracker.recordUsage(
          modelId,
          promptTokens,
          completionTokens,
          recordOptions
        );

        // Update state after recording
        if (enableSync) {
          setCurrentSession(tracker.getCurrentSession());
          setHistory(tracker.getUsageHistory());
        }

        return usage;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Failed to record usage');
        setError(errorObj);
        console.error('Error recording usage:', err);
        throw errorObj;
      }
    },
    [tracker, enableSync]
  );

  const estimateCost = useCallback(
    (
      message: string,
      modelId: string,
      estimatedOutputTokens?: number
    ): CostEstimate => {
      try {
        return tracker.estimateCost(message, modelId, estimatedOutputTokens);
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Failed to estimate cost');
        setError(errorObj);
        console.error('Error estimating cost:', err);
        throw errorObj;
      }
    },
    [tracker]
  );

  // ============================================================================
  // Event Subscription
  // ============================================================================

  useEffect(() => {
    if (!enableSync) return;

    const handleCostEvent = (event: CostEvent) => {
      if (event.type === 'usage_recorded') {
        setCurrentSession(tracker.getCurrentSession());
        setHistory(tracker.getUsageHistory());
      }
    };

    const unsubscribe = tracker.subscribe(handleCostEvent);

    return () => {
      unsubscribe();
    };
  }, [tracker, enableSync]);

  // ============================================================================
  // Auto-Refresh
  // ============================================================================

  useEffect(() => {
    if (refreshInterval <= 0) return;

    const intervalId = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [refresh, refreshInterval]);

  // ============================================================================
  // Initial Load
  // ============================================================================

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ============================================================================
  // Return Hook Interface
  // ============================================================================

  return {
    currentSession,
    history,
    isLoading,
    error,
    getCurrentSession,
    getHistory,
    recordUsage,
    estimateCost,
    refresh,
    tracker,
  };
}

export default useCostTracking;
