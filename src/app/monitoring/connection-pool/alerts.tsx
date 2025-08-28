'use client';

import React, { useEffect, useState } from 'react';
import { Alert, AlertSeverity, AlertType } from '@/lib/db/connection-pool-alerts';
import ConnectionPoolAlertService from '@/lib/db/connection-pool-alerts';

interface ConnectionPoolAlertsProps {
  maxAlerts?: number;
  showControls?: boolean;
  refreshInterval?: number;
}

/**
 * ConnectionPoolAlerts component
 * Displays connection pool alerts in a UI component
 */
const ConnectionPoolAlerts: React.FC<ConnectionPoolAlertsProps> = ({
  maxAlerts = 5,
  showControls = true,
  refreshInterval = 10000,
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAcknowledged, setShowAcknowledged] = useState<boolean>(false);
  const alertService = ConnectionPoolAlertService.getInstance();

  // Fetch alerts initially and on interval
  useEffect(() => {
    const fetchAlerts = () => {
      const activeAlerts = alertService.getActiveAlerts();
      const historyAlerts = alertService.getAlertHistory();
      
      // Combine active and history alerts, filter, sort and limit
      const allAlerts = [...activeAlerts];
      
      // Add historical alerts that aren't already in active alerts
      historyAlerts.forEach(historyAlert => {
        if (!allAlerts.some(alert => alert.id === historyAlert.id)) {
          allAlerts.push(historyAlert);
        }
      });
      
      // Filter acknowledged alerts if needed
      let filteredAlerts = showAcknowledged 
        ? allAlerts 
        : allAlerts.filter(alert => !alert.acknowledged);
      
      // Sort by timestamp (newest first)
      filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      // Limit to maxAlerts
      filteredAlerts = filteredAlerts.slice(0, maxAlerts);
      
      setAlerts(filteredAlerts);
    };
    
    // Start monitoring if not already started
    if (!alertService.isMonitoring()) {
      alertService.startMonitoring();
    }
    
    // Fetch alerts immediately
    fetchAlerts();
    
    // Set up interval to refresh alerts
    const intervalId = setInterval(fetchAlerts, refreshInterval);
    
    // Add listener for new alerts
    const alertListener = (alert: Alert) => {
      fetchAlerts(); // Re-fetch all alerts when a new one comes in
    };
    
    alertService.addAlertListener(alertListener);
    
    // Clean up on component unmount
    return () => {
      clearInterval(intervalId);
      alertService.removeAlertListener(alertListener);
    };
  }, [maxAlerts, refreshInterval, showAcknowledged, alertService]);
  
  const handleAcknowledge = (alertId: string) => {
    alertService.acknowledgeAlert(alertId);
    // Update alerts list
    setAlerts(prevAlerts => 
      prevAlerts.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true } 
          : alert
      )
    );
  };
  
  const handleClear = (alertId: string) => {
    alertService.clearAlert(alertId);
    // Remove from UI
    setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== alertId));
  };
  
  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 'bg-red-100 border-red-500 text-red-700';
      case AlertSeverity.WARNING:
        return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      case AlertSeverity.INFO:
      default:
        return 'bg-blue-100 border-blue-500 text-blue-700';
    }
  };
  
  const getTypeIcon = (type: AlertType) => {
    switch (type) {
      case AlertType.POOL_UTILIZATION:
        return '📊';
      case AlertType.ACQUIRE_FAILURES:
        return '❌';
      case AlertType.VALIDATION_FAILURES:
        return '⚠️';
      case AlertType.CONNECTION_TIMEOUT:
        return '⏱️';
      case AlertType.IDLE_CONNECTIONS:
        return '💤';
      default:
        return '🔔';
    }
  };
  
  if (alerts.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-700 mb-2">Connection Pool Alerts</h3>
        <p className="text-gray-500">No alerts to display</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-700">Connection Pool Alerts</h3>
        {showControls && (
          <div className="flex items-center">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-blue-600"
                checked={showAcknowledged}
                onChange={e => setShowAcknowledged(e.target.checked)}
              />
              <span className="ml-2 text-sm text-gray-600">Show Acknowledged</span>
            </label>
          </div>
        )}
      </div>
      
      <div className="divide-y divide-gray-200">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`p-4 ${getSeverityColor(alert.severity)} ${
              alert.acknowledged ? 'opacity-60' : ''
            }`}
          >
            <div className="flex justify-between">
              <div className="flex items-start">
                <span className="mr-2 text-xl" role="img" aria-label={alert.type}>
                  {getTypeIcon(alert.type)}
                </span>
                <div>
                  <h4 className="font-medium">{alert.message}</h4>
                  <p className="text-sm mt-1">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                  {alert.details && (
                    <div className="mt-2 text-sm">
                      {Object.entries(alert.details).map(([key, value]) => (
                        <div key={key} className="flex">
                          <span className="font-medium mr-1">{key}:</span>
                          <span>
                            {typeof value === 'number' 
                              ? key.includes('threshold') || key.includes('rate') 
                                ? `${value.toFixed(1)}%` 
                                : value 
                              : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {showControls && (
                <div className="flex space-x-2">
                  {!alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => handleClear(alert.id)}
                    className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConnectionPoolAlerts;