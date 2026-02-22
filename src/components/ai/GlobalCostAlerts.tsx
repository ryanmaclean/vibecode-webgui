/**
 * Global Cost Alerts Component
 *
 * Manages and displays cost alert toasts globally across the application.
 * Listens for triggered cost alerts and displays them as toast notifications.
 *
 * @module components/ai/GlobalCostAlerts
 */

'use client';

import { useCallback } from 'react';
import { useCostAlerts } from '@/hooks/useCostAlerts';
import { CostAlertToast } from './CostAlertToast';

// ============================================================================
// Component
// ============================================================================

/**
 * Global cost alerts manager
 *
 * Automatically displays toast notifications for triggered cost alerts.
 * Uses the useCostAlerts hook to subscribe to alert events and manages
 * toast dismissal and acknowledgement.
 */
export function GlobalCostAlerts() {
  const { triggeredAlerts, acknowledgeAlert } = useCostAlerts({
    enableSync: true,
    triggeredOnly: true,
  });

  const handleClose = useCallback(
    (alertId: string) => {
      // Acknowledge the alert when closed
      acknowledgeAlert(alertId);
    },
    [acknowledgeAlert]
  );

  const handleAcknowledge = useCallback(
    (alertId: string) => {
      // Acknowledge the alert
      acknowledgeAlert(alertId);
    },
    [acknowledgeAlert]
  );

  // Show the most critical triggered alert (highest severity)
  // Critical alerts take precedence over warnings and info
  const alertToShow = triggeredAlerts.length > 0
    ? triggeredAlerts.sort((a, b) => {
        const severityOrder = { critical: 3, warning: 2, info: 1 };
        return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      })[0]
    : null;

  if (!alertToShow) {
    return null;
  }

  return (
    <CostAlertToast
      alert={alertToShow}
      onClose={() => handleClose(alertToShow.id)}
      onAcknowledge={handleAcknowledge}
    />
  );
}
