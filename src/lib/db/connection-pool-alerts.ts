/**
 * Connection Pool Alerts Service
 * 
 * Provides alerting functionality for database connection pool monitoring
 */

// Alert severity levels
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

// Alert types
export enum AlertType {
  POOL_UTILIZATION = 'pool_utilization',
  ACQUIRE_FAILURES = 'acquire_failures',
  VALIDATION_FAILURES = 'validation_failures',
  CONNECTION_TIMEOUT = 'connection_timeout',
  IDLE_CONNECTIONS = 'idle_connections',
  POOL_EXHAUSTION = 'pool_exhaustion',
  QUERY_TIMEOUT = 'query_timeout',
  GENERAL = 'general'
}

// Alert interface
export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  details?: Record<string, any>;
}

// Alert listener function type
type AlertListener = (alert: Alert) => void;

/**
 * Connection Pool Alert Service
 * Monitors connection pool and generates alerts
 */
export default class ConnectionPoolAlertService {
  private static instance: ConnectionPoolAlertService;
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private listeners: AlertListener[] = [];
  private isMonitoringActive = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertThresholds = {
    poolUtilization: {
      warning: 70, // 70% utilization
      critical: 90 // 90% utilization
    },
    acquireTime: {
      warning: 500, // 500ms
      critical: 2000 // 2 seconds
    },
    failedAcquires: {
      warning: 5, // 5 failures in monitoring interval
      critical: 20 // 20 failures in monitoring interval
    },
    idleConnections: {
      warning: 80, // 80% idle connections
      critical: 90 // 90% idle connections
    }
  };
  private lastAlertTimes: Map<string, number> = new Map();
  private alertSuppression = 60000; // 1 minute between similar alerts
  private lastCheckTime = Date.now();
  private failedAcquiresCount = 0;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Initialize alert service
  }

  /**
   * Get singleton instance
   * @returns Alert service instance
   */
  public static getInstance(): ConnectionPoolAlertService {
    if (!ConnectionPoolAlertService.instance) {
      ConnectionPoolAlertService.instance = new ConnectionPoolAlertService();
    }
    return ConnectionPoolAlertService.instance;
  }

  /**
   * Start monitoring connection pool
   * @param intervalMs Monitoring interval in milliseconds
   */
  public startMonitoring(intervalMs = 30000): void {
    if (this.isMonitoringActive) {
      return;
    }
    
    this.isMonitoringActive = true;
    
    // Set up monitoring interval
    this.monitoringInterval = setInterval(() => {
      this.checkConnectionPool();
    }, intervalMs);
    
    // Initial check
    this.checkConnectionPool();
  }

  /**
   * Stop monitoring connection pool
   */
  public stopMonitoring(): void {
    if (!this.isMonitoringActive || !this.monitoringInterval) {
      return;
    }
    
    clearInterval(this.monitoringInterval);
    this.monitoringInterval = null;
    this.isMonitoringActive = false;
  }

  /**
   * Check if monitoring is active
   * @returns True if monitoring is active
   */
  public isMonitoring(): boolean {
    return this.isMonitoringActive;
  }

  /**
   * Check connection pool metrics and generate alerts
   */
  private checkConnectionPool(): void {
    try {
      // Import dynamically to avoid circular dependencies
      const { getVectorConnectionPool } = require('./vector-connection-pool');
      const pool = getVectorConnectionPool();
      const metrics = pool.getMetrics();
      
      // Check pool utilization
      const utilization = metrics.activeConnections / metrics.totalConnections;
      if (utilization >= this.alertThresholds.poolUtilization.critical / 100) {
        this.addAlert({
          severity: AlertSeverity.CRITICAL,
          type: AlertType.POOL_UTILIZATION,
          message: 'Critical: Connection pool utilization exceeds threshold',
          details: {
            currentUtilization: utilization * 100,
            activeConnections: metrics.activeConnections,
            totalConnections: metrics.totalConnections,
            criticalThreshold: this.alertThresholds.poolUtilization.critical
          }
        });
      } else if (utilization >= this.alertThresholds.poolUtilization.warning / 100) {
        this.addAlert({
          severity: AlertSeverity.WARNING,
          type: AlertType.POOL_UTILIZATION,
          message: 'Warning: Connection pool utilization approaching threshold',
          details: {
            currentUtilization: utilization * 100,
            activeConnections: metrics.activeConnections,
            totalConnections: metrics.totalConnections,
            warningThreshold: this.alertThresholds.poolUtilization.warning
          }
        });
      }
      
      // Check acquire time
      if (metrics.avgAcquireTime >= this.alertThresholds.acquireTime.critical) {
        this.addAlert({
          severity: AlertSeverity.CRITICAL,
          type: AlertType.CONNECTION_TIMEOUT,
          message: 'Critical: Connection acquisition time exceeds threshold',
          details: {
            avgAcquireTime: metrics.avgAcquireTime,
            criticalThreshold: this.alertThresholds.acquireTime.critical
          }
        });
      } else if (metrics.avgAcquireTime >= this.alertThresholds.acquireTime.warning) {
        this.addAlert({
          severity: AlertSeverity.WARNING,
          type: AlertType.CONNECTION_TIMEOUT,
          message: 'Warning: Connection acquisition time approaching threshold',
          details: {
            avgAcquireTime: metrics.avgAcquireTime,
            warningThreshold: this.alertThresholds.acquireTime.warning
          }
        });
      }
      
      // Check failed acquires
      if (metrics.failedAcquireCount > this.failedAcquiresCount) {
        const newFailures = metrics.failedAcquireCount - this.failedAcquiresCount;
        this.failedAcquiresCount = metrics.failedAcquireCount;
        
        if (newFailures >= this.alertThresholds.failedAcquires.critical) {
          this.addAlert({
            severity: AlertSeverity.CRITICAL,
            type: AlertType.ACQUIRE_FAILURES,
            message: 'Critical: Multiple connection acquisition failures',
            details: {
              recentFailures: newFailures,
              totalFailures: metrics.failedAcquireCount,
              criticalThreshold: this.alertThresholds.failedAcquires.critical
            }
          });
        } else if (newFailures >= this.alertThresholds.failedAcquires.warning) {
          this.addAlert({
            severity: AlertSeverity.WARNING,
            type: AlertType.ACQUIRE_FAILURES,
            message: 'Warning: Connection acquisition failures detected',
            details: {
              recentFailures: newFailures,
              totalFailures: metrics.failedAcquireCount,
              warningThreshold: this.alertThresholds.failedAcquires.warning
            }
          });
        }
      }
      
      // Check idle connections ratio
      if (metrics.totalConnections > 0) {
        const idleRatio = (metrics.idleConnections / metrics.totalConnections) * 100;
        if (idleRatio >= this.alertThresholds.idleConnections.critical) {
          this.addAlert({
            severity: AlertSeverity.WARNING,
            type: AlertType.IDLE_CONNECTIONS,
            message: 'Warning: High number of idle connections',
            details: {
              idleRatio: idleRatio,
              idleConnections: metrics.idleConnections,
              totalConnections: metrics.totalConnections,
              criticalThreshold: this.alertThresholds.idleConnections.critical
            }
          });
        }
      }
      
      // Check waiting requests
      if (metrics.waitingRequests > 0) {
        this.addAlert({
          severity: AlertSeverity.WARNING,
          type: AlertType.POOL_EXHAUSTION,
          message: 'Warning: Connection requests are queued',
          details: {
            waitingRequests: metrics.waitingRequests,
            activeConnections: metrics.activeConnections,
            totalConnections: metrics.totalConnections
          }
        });
      }
    } catch (error) {
      console.error('Error monitoring connection pool:', error);
      
      // Add general error alert
      this.addAlert({
        severity: AlertSeverity.WARNING,
        type: AlertType.GENERAL,
        message: 'Warning: Error monitoring connection pool',
        details: {
          error: (error as Error).message
        }
      });
    }
  }

  /**
   * Add a new alert
   * @param alertData Alert data
   */
  public addAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>): void {
    // Generate alert ID
    const alertId = `${alertData.type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Check for alert suppression
    const suppressionKey = `${alertData.type}-${alertData.message}`;
    const lastAlertTime = this.lastAlertTimes.get(suppressionKey) || 0;
    const now = Date.now();
    
    if (now - lastAlertTime < this.alertSuppression) {
      // Skip alert due to suppression
      return;
    }
    
    // Update last alert time
    this.lastAlertTimes.set(suppressionKey, now);
    
    // Create alert object
    const alert: Alert = {
      id: alertId,
      timestamp: new Date(),
      acknowledged: false,
      ...alertData
    };
    
    // Add to active alerts
    this.activeAlerts.set(alertId, alert);
    
    // Notify listeners
    this.notifyListeners(alert);
  }

  /**
   * Get all active alerts
   * @returns Array of active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   * @returns Array of historical alerts
   */
  public getAlertHistory(): Alert[] {
    return [...this.alertHistory];
  }

  /**
   * Acknowledge an alert
   * @param alertId Alert ID to acknowledge
   * @returns True if alert was acknowledged
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Clear an alert
   * @param alertId Alert ID to clear
   * @returns True if alert was cleared
   */
  public clearAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      // Move to history
      this.alertHistory.unshift(alert);
      
      // Limit history size
      if (this.alertHistory.length > 100) {
        this.alertHistory.pop();
      }
      
      // Remove from active alerts
      this.activeAlerts.delete(alertId);
      return true;
    }
    return false;
  }

  /**
   * Add alert listener
   * @param listener Listener function
   */
  public addAlertListener(listener: AlertListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove alert listener
   * @param listener Listener function to remove
   */
  public removeAlertListener(listener: AlertListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of a new alert
   * @param alert Alert to notify about
   */
  private notifyListeners(alert: Alert): void {
    for (const listener of this.listeners) {
      try {
        listener(alert);
      } catch (error) {
        console.error('Error in alert listener:', error);
      }
    }
  }

  /**
   * Update alert thresholds
   * @param thresholds New threshold values
   */
  public updateThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = {
      ...this.alertThresholds,
      ...thresholds
    };
  }

  /**
   * Set alert suppression time
   * @param milliseconds Suppression time in milliseconds
   */
  public setAlertSuppression(milliseconds: number): void {
    this.alertSuppression = milliseconds;
  }
}