/**
 * Cost Alerts Hook for VibeCode AI
 *
 * Provides React hooks for accessing and managing AI cost alerts.
 * Wraps the CostTracker alert functionality with reactive state management.
 *
 * @module hooks/useCostAlerts
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getCostTracker,
  CostTracker,
} from '@/lib/ai/cost/cost-tracker';
import {
  CostAlert,
  CostAlertConfig,
  CostEvent,
} from '@/types/cost-estimation';

// ============================================================================
// Hook Options
// ============================================================================

export interface UseCostAlertsOptions {
  /** Custom cost tracker instance */
  costTracker?: CostTracker;
  /** Auto-refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
  /** Enable automatic data syncing */
  enableSync?: boolean;
  /** Only return triggered alerts */
  triggeredOnly?: boolean;
}

// ============================================================================
// Hook Return Type
// ============================================================================

export interface UseCostAlertsReturn {
  /** All cost alerts */
  alerts: CostAlert[];
  /** Triggered alerts only */
  triggeredAlerts: CostAlert[];
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error state if any */
  error: Error | null;
  /** Create a new cost alert */
  createAlert: (config: CostAlertConfig) => CostAlert;
  /** Update an existing alert */
  updateAlert: (alertId: string, updates: Partial<CostAlertConfig>) => CostAlert | null;
  /** Delete an alert */
  deleteAlert: (alertId: string) => boolean;
  /** Acknowledge a triggered alert */
  acknowledgeAlert: (alertId: string) => boolean;
  /** Refresh alerts from storage */
  refresh: () => void;
  /** Cost tracker instance for advanced usage */
  tracker: CostTracker;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing AI cost alerts
 *
 * Provides reactive access to cost alerts, including creation, updates, and
 * acknowledgement. Automatically syncs with local storage and updates when
 * alerts are triggered.
 *
 * @param options - Configuration options for the hook
 * @returns Cost alerts state and methods
 *
 * @example
 * ```tsx
 * function AlertsPanel() {
 *   const {
 *     alerts,
 *     triggeredAlerts,
 *     createAlert,
 *     acknowledgeAlert,
 *   } = useCostAlerts();
 *
 *   // Create a budget alert
 *   const handleCreateBudgetAlert = () => {
 *     createAlert({
 *       type: 'budget_threshold',
 *       threshold: 100,
 *       enabled: true,
 *       notifyOnTrigger: true,
 *       notificationChannels: ['in_app', 'email'],
 *     });
 *   };
 *
 *   // Display triggered alerts
 *   return (
 *     <div>
 *       {triggeredAlerts.map(alert => (
 *         <Alert key={alert.id} severity={alert.severity}>
 *           {alert.message}
 *           <button onClick={() => acknowledgeAlert(alert.id)}>
 *             Dismiss
 *           </button>
 *         </Alert>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With auto-refresh and triggered-only mode
 * function LiveAlertMonitor() {
 *   const { triggeredAlerts } = useCostAlerts({
 *     refreshInterval: 5000, // Refresh every 5 seconds
 *     triggeredOnly: true,
 *   });
 *
 *   if (triggeredAlerts.length === 0) {
 *     return <p>No active alerts</p>;
 *   }
 *
 *   return (
 *     <AlertList alerts={triggeredAlerts} />
 *   );
 * }
 * ```
 */
export function useCostAlerts(
  options: UseCostAlertsOptions = {}
): UseCostAlertsReturn {
  const {
    costTracker,
    refreshInterval = 0,
    enableSync = true,
    triggeredOnly = false,
  } = options;

  // ============================================================================
  // State Management
  // ============================================================================

  const tracker = useMemo(
    () => costTracker || getCostTracker(),
    [costTracker]
  );

  const [alerts, setAlerts] = useState<CostAlert[]>(() =>
    tracker.getAlerts()
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const triggeredAlerts = useMemo(
    () => alerts.filter((alert) => alert.triggered && alert.enabled),
    [alerts]
  );

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const refresh = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);

      const allAlerts = tracker.getAlerts();
      setAlerts(allAlerts);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh alerts'));
      console.error('Error refreshing cost alerts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tracker]);

  // ============================================================================
  // Alert Management Methods
  // ============================================================================

  const createAlert = useCallback(
    (config: CostAlertConfig): CostAlert => {
      try {
        const newAlert = tracker.createAlert(config);

        // Update state after creating
        if (enableSync) {
          setAlerts(tracker.getAlerts());
        }

        return newAlert;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Failed to create alert');
        setError(errorObj);
        console.error('Error creating alert:', err);
        throw errorObj;
      }
    },
    [tracker, enableSync]
  );

  const updateAlert = useCallback(
    (alertId: string, updates: Partial<CostAlertConfig>): CostAlert | null => {
      try {
        const updatedAlert = tracker.updateAlert(alertId, updates);

        // Update state after updating
        if (enableSync && updatedAlert) {
          setAlerts(tracker.getAlerts());
        }

        return updatedAlert;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Failed to update alert');
        setError(errorObj);
        console.error('Error updating alert:', err);
        throw errorObj;
      }
    },
    [tracker, enableSync]
  );

  const deleteAlert = useCallback(
    (alertId: string): boolean => {
      try {
        const success = tracker.deleteAlert(alertId);

        // Update state after deleting
        if (enableSync && success) {
          setAlerts(tracker.getAlerts());
        }

        return success;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Failed to delete alert');
        setError(errorObj);
        console.error('Error deleting alert:', err);
        throw errorObj;
      }
    },
    [tracker, enableSync]
  );

  const acknowledgeAlert = useCallback(
    (alertId: string): boolean => {
      try {
        const success = tracker.acknowledgeAlert(alertId);

        // Update state after acknowledging
        if (enableSync && success) {
          setAlerts(tracker.getAlerts());
        }

        return success;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Failed to acknowledge alert');
        setError(errorObj);
        console.error('Error acknowledging alert:', err);
        throw errorObj;
      }
    },
    [tracker, enableSync]
  );

  // ============================================================================
  // Event Subscription
  // ============================================================================

  useEffect(() => {
    if (!enableSync) return;

    const handleCostEvent = (event: CostEvent) => {
      // Update alerts when they're triggered or when usage is recorded
      // (which might trigger new alerts)
      if (event.type === 'alert_triggered' || event.type === 'usage_recorded') {
        setAlerts(tracker.getAlerts());
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
    alerts: triggeredOnly ? triggeredAlerts : alerts,
    triggeredAlerts,
    isLoading,
    error,
    createAlert,
    updateAlert,
    deleteAlert,
    acknowledgeAlert,
    refresh,
    tracker,
  };
}

export default useCostAlerts;
