/**
 * Connection Pool Alerts Service
 * 
 * Provides alerting functionality for database connection pool monitoring
 */
import { VectorConnectionPoolFactory } from './vector-connection-pool';

type VectorModule = typeof import('./vector-connection-pool');

let testVectorModule: VectorModule | null = null;
let forcedBrowserEnvironment: boolean | null = null;
let cachedVectorModule: VectorModule | null = null;
let overrideFactory: typeof VectorConnectionPoolFactory | null = null;
let forceNoVectorModule = false;

// Alert severity levels
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

// Configuration structures used by UI components
export interface ThresholdConfig {
  enabled: boolean;
  warningThreshold: number;
  criticalThreshold: number;
}

export interface AlertConfig {
  poolUtilization: ThresholdConfig;
  acquireFailures: ThresholdConfig;
  validationFailures: ThresholdConfig;
  idleConnections: ThresholdConfig;
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
  details?: Record<string, unknown>;
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
    poolUtilization: { enabled: true, warning: 70, critical: 90 },
    acquireTime:     { enabled: true, warning: 500, critical: 2000 },
    failedAcquires:  { enabled: true, warning: 5, critical: 20 },
    idleConnections: { enabled: true, warning: 80, critical: 90 },
    validationFailures: { enabled: false, warning: 10, critical: 25 } // placeholder; metric not yet wired
  };
  private lastAlertTimes: Map<string, number> = new Map();
  private alertSuppression = 60000; // 1 minute between similar alerts
  private lastCheckTime = Date.now();
  private lastTimeoutCount = 0;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Initialize alert service
  }

  // Configuration API for UI consumption
  public getPoolUtilizationConfig(): ThresholdConfig {
    return {
      enabled: this.alertThresholds.poolUtilization.enabled,
      warningThreshold: this.alertThresholds.poolUtilization.warning,
      criticalThreshold: this.alertThresholds.poolUtilization.critical,
    };
  }

  public getAcquireFailuresConfig(): ThresholdConfig {
    return {
      enabled: this.alertThresholds.failedAcquires.enabled,
      warningThreshold: this.alertThresholds.failedAcquires.warning,
      criticalThreshold: this.alertThresholds.failedAcquires.critical,
    };
  }

  public getValidationFailuresConfig(): ThresholdConfig {
    return {
      enabled: this.alertThresholds.validationFailures.enabled,
      warningThreshold: this.alertThresholds.validationFailures.warning,
      criticalThreshold: this.alertThresholds.validationFailures.critical,
    };
  }

  public getIdleConnectionsConfig(): ThresholdConfig {
    return {
      enabled: this.alertThresholds.idleConnections.enabled,
      warningThreshold: this.alertThresholds.idleConnections.warning,
      criticalThreshold: this.alertThresholds.idleConnections.critical,
    };
  }

  public updateConfig(newConfig: AlertConfig): void {
    this.alertThresholds.poolUtilization.enabled = newConfig.poolUtilization.enabled;
    this.alertThresholds.poolUtilization.warning = newConfig.poolUtilization.warningThreshold;
    this.alertThresholds.poolUtilization.critical = newConfig.poolUtilization.criticalThreshold;

    this.alertThresholds.failedAcquires.enabled = newConfig.acquireFailures.enabled;
    this.alertThresholds.failedAcquires.warning = newConfig.acquireFailures.warningThreshold;
    this.alertThresholds.failedAcquires.critical = newConfig.acquireFailures.criticalThreshold;

    this.alertThresholds.validationFailures.enabled = newConfig.validationFailures.enabled;
    this.alertThresholds.validationFailures.warning = newConfig.validationFailures.warningThreshold;
    this.alertThresholds.validationFailures.critical = newConfig.validationFailures.criticalThreshold;

    this.alertThresholds.idleConnections.enabled = newConfig.idleConnections.enabled;
    this.alertThresholds.idleConnections.warning = newConfig.idleConnections.warningThreshold;
    this.alertThresholds.idleConnections.critical = newConfig.idleConnections.criticalThreshold;
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
      if (forceNoVectorModule && !overrideFactory) {
        return;
      }

      // Use pool factory to avoid circular deps and ensure availability
      const factory = overrideFactory ?? VectorConnectionPoolFactory;

      let pool = factory.getPool('default');
      if (!pool) {
        pool = factory.createPool({
          host: process.env.DATABASE_HOST || 'localhost',
          port: parseInt(process.env.DATABASE_PORT || '5432', 10),
          database: process.env.DATABASE_NAME || 'vibecode',
          user: process.env.DATABASE_USER || 'postgres',
          password: process.env.DATABASE_PASSWORD || 'password'
        }, {}, 'default');
      }
      const metrics = pool.getMetrics();
      
      // Check pool utilization
      const utilization = metrics.poolSize > 0 ? (metrics.activeConnections / metrics.poolSize) * 100 : 0;
      if (this.alertThresholds.poolUtilization.enabled && utilization >= this.alertThresholds.poolUtilization.critical) {
        this.addAlert({
          severity: AlertSeverity.CRITICAL,
          type: AlertType.POOL_UTILIZATION,
          message: 'Critical: Connection pool utilization exceeds threshold',
          details: {
            currentUtilization: utilization,
            activeConnections: metrics.activeConnections,
            totalConnections: metrics.poolSize,
            criticalThreshold: this.alertThresholds.poolUtilization.critical
          }
        });
      } else if (this.alertThresholds.poolUtilization.enabled && utilization >= this.alertThresholds.poolUtilization.warning) {
        this.addAlert({
          severity: AlertSeverity.WARNING,
          type: AlertType.POOL_UTILIZATION,
          message: 'Warning: Connection pool utilization approaching threshold',
          details: {
            currentUtilization: utilization,
            activeConnections: metrics.activeConnections,
            totalConnections: metrics.poolSize,
            warningThreshold: this.alertThresholds.poolUtilization.warning
          }
        });
      }
      
      // Check acquire time
      if (this.alertThresholds.acquireTime.enabled && metrics.avgAcquireTime >= this.alertThresholds.acquireTime.critical) {
        this.addAlert({
          severity: AlertSeverity.CRITICAL,
          type: AlertType.CONNECTION_TIMEOUT,
          message: 'Critical: Connection acquisition time exceeds threshold',
          details: {
            avgAcquireTime: metrics.avgAcquireTime,
            criticalThreshold: this.alertThresholds.acquireTime.critical
          }
        });
      } else if (this.alertThresholds.acquireTime.enabled && metrics.avgAcquireTime >= this.alertThresholds.acquireTime.warning) {
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
      if (this.alertThresholds.failedAcquires.enabled && metrics.totalTimeouts > this.lastTimeoutCount) {
        const newFailures = metrics.totalTimeouts - this.lastTimeoutCount;
        this.lastTimeoutCount = metrics.totalTimeouts;
        
        if (newFailures >= this.alertThresholds.failedAcquires.critical) {
          this.addAlert({
            severity: AlertSeverity.CRITICAL,
            type: AlertType.ACQUIRE_FAILURES,
            message: 'Critical: Multiple connection acquisition failures',
            details: {
              recentFailures: newFailures,
              totalFailures: metrics.totalTimeouts,
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
              totalFailures: metrics.totalTimeouts,
              warningThreshold: this.alertThresholds.failedAcquires.warning
            }
          });
        }
      }
      
      // Check idle connections ratio
      if (this.alertThresholds.idleConnections.enabled && metrics.poolSize > 0) {
        const idleRatio = (metrics.availableConnections / metrics.poolSize) * 100;
        if (idleRatio >= this.alertThresholds.idleConnections.critical) {
          this.addAlert({
            severity: AlertSeverity.WARNING,
            type: AlertType.IDLE_CONNECTIONS,
            message: 'Warning: High number of idle connections',
            details: {
              idleRatio: idleRatio,
              idleConnections: metrics.availableConnections,
              totalConnections: metrics.poolSize,
              criticalThreshold: this.alertThresholds.idleConnections.critical
            }
          });
        }
      }
      
      // Check waiting requests
      if (metrics.waitingClients > 0) {
        this.addAlert({
          severity: AlertSeverity.WARNING,
          type: AlertType.POOL_EXHAUSTION,
          message: 'Warning: Connection requests are queued',
          details: {
            waitingRequests: metrics.waitingClients,
            activeConnections: metrics.activeConnections,
            totalConnections: metrics.poolSize
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

async function loadVectorModule(): Promise<VectorModule | null> {
  if (forcedBrowserEnvironment === true) {
    return null;
  }

  if (testVectorModule) {
    return testVectorModule;
  }

  if (forcedBrowserEnvironment === false || typeof window === 'undefined') {
    if (!cachedVectorModule) {
      cachedVectorModule = await import('./vector-connection-pool');
    }
    return cachedVectorModule;
  }

  return null;
}

export async function __loadVectorConnectionPoolModuleForTest(): Promise<VectorModule | null> {
  return loadVectorModule();
}

export function __setVectorConnectionPoolModule(module: VectorModule | null): void {
  testVectorModule = module;
  overrideFactory = module ? module.VectorConnectionPoolFactory : null;
  forceNoVectorModule = false;
}

export function __resetVectorConnectionPoolModule(): void {
  testVectorModule = null;
  cachedVectorModule = null;
  overrideFactory = null;
  forceNoVectorModule = false;
}

export function __setBrowserEnvironmentForTest(value: boolean | null): void {
  forcedBrowserEnvironment = value;
}

export function __forceVectorModuleUnavailableForTest(): void {
  forceNoVectorModule = true;
}
