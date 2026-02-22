/**
 * Cost Alert Toast Component
 *
 * Displays cost-related alerts as toast notifications with:
 * - Auto-dismissal after 10 seconds
 * - Severity-based styling (info, warning, critical)
 * - Cost information display
 * - Progress bar animation
 * - Manual dismiss option
 *
 * @module components/ai/CostAlertToast
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Info, AlertTriangle, AlertCircle, DollarSign, TrendingUp } from 'lucide-react';
import { CostAlert, AlertSeverity } from '@/types/cost-estimation';

// ============================================================================
// Types
// ============================================================================

interface CostAlertToastProps {
  /** The cost alert to display */
  alert: CostAlert;
  /** Duration in milliseconds before auto-dismiss (default: 10000) */
  duration?: number;
  /** Callback when toast is closed */
  onClose: () => void;
  /** Callback when alert is acknowledged */
  onAcknowledge?: (alertId: string) => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function getPercentage(current: number, threshold: number): number {
  if (threshold === 0) return 0;
  return Math.min((current / threshold) * 100, 100);
}

// ============================================================================
// Component
// ============================================================================

export function CostAlertToast({
  alert,
  duration = 10000,
  onClose,
  onAcknowledge,
}: CostAlertToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  }, [onClose]);

  const handleAcknowledge = useCallback(() => {
    if (onAcknowledge) {
      onAcknowledge(alert.id);
    }
    handleClose();
  }, [alert.id, onAcknowledge, handleClose]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  // Severity-based configuration
  const severityConfig: Record<AlertSeverity, {
    icon: JSX.Element;
    bg: string;
    border: string;
    text: string;
    iconColor: string;
    progressColor: string;
  }> = {
    info: {
      icon: <Info className="h-5 w-5" />,
      bg: 'bg-blue-50',
      border: 'border-blue-500',
      text: 'text-blue-800',
      iconColor: 'text-blue-500',
      progressColor: 'bg-blue-500',
    },
    warning: {
      icon: <AlertTriangle className="h-5 w-5" />,
      bg: 'bg-yellow-50',
      border: 'border-yellow-500',
      text: 'text-yellow-800',
      iconColor: 'text-yellow-500',
      progressColor: 'bg-yellow-500',
    },
    critical: {
      icon: <AlertCircle className="h-5 w-5" />,
      bg: 'bg-red-50',
      border: 'border-red-500',
      text: 'text-red-800',
      iconColor: 'text-red-500',
      progressColor: 'bg-red-500',
    },
  };

  const config = severityConfig[alert.severity];
  const percentage = getPercentage(alert.current, alert.threshold);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 w-96 transition-all duration-300 transform ${
        isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className={`${config.bg} ${config.border} border-l-4 rounded-lg shadow-lg overflow-hidden`}>
        <div className="p-4">
          <div className="flex items-start">
            <div className={`flex-shrink-0 pt-0.5 ${config.iconColor}`}>
              {config.icon}
            </div>
            <div className="ml-3 w-0 flex-1">
              {/* Alert Title */}
              <p className={`text-sm font-semibold ${config.text} mb-1`}>
                {getAlertTitle(alert.type)}
              </p>

              {/* Alert Message */}
              <p className={`text-sm ${config.text} mb-2`}>
                {alert.message}
              </p>

              {/* Cost Information */}
              <div className="flex items-center justify-between text-xs mt-2">
                <div className="flex items-center space-x-1">
                  <DollarSign className="h-3 w-3" />
                  <span className={`font-medium ${config.text}`}>
                    Current: {formatCost(alert.current)}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <TrendingUp className="h-3 w-3" />
                  <span className={`font-medium ${config.text}`}>
                    Limit: {formatCost(alert.threshold)}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              {alert.threshold > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs ${config.text}`}>
                      {percentage.toFixed(0)}% of limit
                    </span>
                  </div>
                  <div className="w-full bg-white/50 rounded-full h-1.5">
                    <div
                      className={`${config.progressColor} h-1.5 rounded-full transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Acknowledge Button */}
              {onAcknowledge && (
                <button
                  onClick={handleAcknowledge}
                  className={`mt-3 text-xs font-medium ${config.text} hover:underline focus:outline-none`}
                >
                  Acknowledge
                </button>
              )}
            </div>

            {/* Close Button */}
            <div className="ml-4 flex-shrink-0 flex">
              <button
                onClick={handleClose}
                className="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none transition-colors"
                aria-label="Close notification"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Auto-dismiss Progress Bar */}
        <div className="bg-white/30 h-1 w-full">
          <div
            className={`h-full animate-progress ${config.progressColor}`}
            data-duration={duration}
          />
        </div>
      </div>

      {/* Inline Styles for Animation */}
      <style jsx global>{`
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-progress {
          animation-name: progress;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
          animation-duration: var(--toast-duration);
        }
      `}</style>
      <style jsx global>{`
        .animate-progress {
          --toast-duration: ${duration}ms;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getAlertTitle(type: CostAlert['type']): string {
  const titles: Record<CostAlert['type'], string> = {
    budget_threshold: 'Budget Threshold Reached',
    daily_limit: 'Daily Limit Reached',
    session_limit: 'Session Limit Reached',
    rate_spike: 'Unusual Cost Spike Detected',
    unusual_usage: 'Unusual Usage Pattern',
  };
  return titles[type];
}
