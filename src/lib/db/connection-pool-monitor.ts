import { EventEmitter } from 'events';
import { VectorConnectionPool, PoolEvent } from './vector-connection-pool';
import { PoolStatus } from '../vector-db/pool-status';
import { PoolStatusInfo } from './connection-pool-types';
// import { logger } from '@/lib/logger';
/**
 * Alert levels for the connection pool monitor
 */
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

/**
 * Alert types for the connection pool monitor
 */
export enum AlertType {
  POOL_EXHAUSTION = 'pool_exhaustion',
  HIGH_UTILIZATION = 'high_utilization',
  LONG_WAIT_TIME = 'long_wait_time',
  CONNECTION_ERRORS = 'connection_errors',
  IDLE_CONNECTIONS = 'idle_connections',
  POOL_RECOVERY = 'pool_recovery'
}

/**
 * Alert interface for connection pool alerts
 */
export interface PoolAlert {
  id: string;
  poolName: string;
  timestamp: Date;
  type: AlertType;
  level: AlertLevel;
  message: string;
  metrics: {
    utilization: number;
    waitingClients: number;
    activeConnections: number;
    maxConnections: number;
    errorRate?: number;
    avgAcquireTime?: number;
  };
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

/**
 * Pool capacity recommendation types
 */
export enum RecommendationType {
  INCREASE_MAX_CONNECTIONS = 'increase_max_connections',
  DECREASE_MAX_CONNECTIONS = 'decrease_max_connections',
  ADD_SHARDS = 'add_shards',
  OPTIMIZE_QUERIES = 'optimize_queries',
  IMPLEMENT_CACHING = 'implement_caching'
}

/**
 * Capacity recommendation for connection pools
 */
export interface CapacityRecommendation {
  id: string;
  poolName: string;
  timestamp: Date;
  type: RecommendationType;
  message: string;
  currentValue: number;
  recommendedValue: number;
  confidence: number;
  implemented: boolean;
  implementedAt?: Date;
}

/**
 * Pool utilization thresholds for alerting
 */
interface UtilizationThresholds {
  warning: number;
  critical: number;
}

/**
 * Configuration for the connection pool monitor
 */
interface ConnectionPoolMonitorConfig {
  poolUtilizationThresholds: UtilizationThresholds;
  waitingClientsThresholds: UtilizationThresholds;
  checkIntervalMs: number;
  alertCooldownMs: number;
  retentionPeriodMs: number;
  autoAcknowledgeAlerts: boolean;
  enableCapacityPlanning: boolean;
  capacityPlanningIntervalMs: number;
}

/**
 * Default configuration for the connection pool monitor
 */
const DEFAULT_CONFIG: ConnectionPoolMonitorConfig = {
  poolUtilizationThresholds: {
    warning: 70,
    critical: 85
  },
  waitingClientsThresholds: {
    warning: 5,
    critical: 15
  },
  checkIntervalMs: 5000, // Check every 5 seconds
  alertCooldownMs: 60000, // 1 minute between similar alerts
  retentionPeriodMs: 86400000, // 24 hours
  autoAcknowledgeAlerts: true,
  enableCapacityPlanning: true,
  capacityPlanningIntervalMs: 300000 // 5 minutes
};

/**
 * Events emitted by the connection pool monitor
 */
export enum MonitorEvent {
  ALERT = 'alert',
  RECOMMENDATION = 'recommendation',
  METRICS_UPDATED = 'metrics_updated'
}

/**
 * Monitors connection pools for health and capacity issues
 */
export class ConnectionPoolMonitor extends EventEmitter {
  private readonly config: ConnectionPoolMonitorConfig;
  private readonly pools: Map<string, VectorConnectionPool> = new Map();
  private readonly alerts: PoolAlert[] = [];
  private readonly recommendations: CapacityRecommendation[] = [];
  private readonly metrics: Map<string, any> = new Map();
  private readonly alertHistory: Map<string, Date> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private capacityPlanningInterval: NodeJS.Timeout | null = null;

  /**
   * Creates a new connection pool monitor
   * @param config Configuration for the monitor
   */
  constructor(config: Partial<ConnectionPoolMonitorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Starts monitoring the connection pools
   */
  public start(): void {
    if (this.checkInterval) {
      return;
    }

    console.log('Starting connection pool monitor');

    // Start regular health checks
    this.checkInterval = setInterval(() => {
      this.checkPools();
    }, this.config.checkIntervalMs);

    // Start capacity planning if enabled
    if (this.config.enableCapacityPlanning) {
      this.capacityPlanningInterval = setInterval(() => {
        this.analyzeCapacity();
      }, this.config.capacityPlanningIntervalMs);
    }
  }

  /**
   * Stops monitoring the connection pools
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.capacityPlanningInterval) {
      clearInterval(this.capacityPlanningInterval);
      this.capacityPlanningInterval = null;
    }

    console.log('Connection pool monitor stopped');
  }

  /**
   * Adds a connection pool to monitor
   * @param poolName The name of the pool
   * @param pool The connection pool
   */
  public monitorPool(poolName: string, pool: VectorConnectionPool): void {
    if (this.pools.has(poolName)) {
      return;
    }

    this.pools.set(poolName, pool);

    // Listen for pool events
    pool.on(PoolEvent.ACQUIRED, this.handlePoolEvent.bind(this));
    pool.on(PoolEvent.RELEASED, this.handlePoolEvent.bind(this));
    pool.on(PoolEvent.EXHAUSTED, this.handlePoolEvent.bind(this));
    pool.on(PoolEvent.TIMEOUT, this.handlePoolEvent.bind(this));
    pool.on(PoolEvent.ERROR, this.handlePoolEvent.bind(this));

    console.log(`Now monitoring connection pool: ${poolName}`);
  }

  /**
   * Removes a connection pool from monitoring
   * @param poolName The name of the pool
   */
  public unmonitorPool(poolName: string): void {
    const pool = this.pools.get(poolName);
    if (!pool) {
      return;
    }

    // Remove event listeners
    pool.removeAllListeners(PoolEvent.ACQUIRED);
    pool.removeAllListeners(PoolEvent.RELEASED);
    pool.removeAllListeners(PoolEvent.EXHAUSTED);
    pool.removeAllListeners(PoolEvent.TIMEOUT);
    pool.removeAllListeners(PoolEvent.ERROR);

    this.pools.delete(poolName);
    console.log(`Stopped monitoring connection pool: ${poolName}`);
  }

  /**
   * Gets all current alerts
   * @param activeOnly Whether to only include active (unacknowledged) alerts
   * @returns Array of pool alerts
   */
  public getAlerts(activeOnly: boolean = true): PoolAlert[] {
    if (activeOnly) {
      return this.alerts.filter(alert => !alert.acknowledged);
    }
    return [...this.alerts];
  }

  /**
   * Gets all capacity recommendations
   * @param unimplementedOnly Whether to only include unimplemented recommendations
   * @returns Array of capacity recommendations
   */
  public getRecommendations(unimplementedOnly: boolean = true): CapacityRecommendation[] {
    if (unimplementedOnly) {
      return this.recommendations.filter(rec => !rec.implemented);
    }
    return [...this.recommendations];
  }

  /**
   * Gets metrics for all monitored pools
   * @returns Map of pool names to metrics
   */
  public getMetrics(): Map<string, any> {
    // Update metrics first
    for (const [poolName, pool] of this.pools.entries()) {
      this.metrics.set(poolName, pool.getMetrics());
    }
    return new Map(this.metrics);
  }

  /**
   * Gets the status of all monitored pools
   * @returns Map of pool names to pool status
   */
  public getPoolStatus(): Map<string, PoolStatusInfo> {
    const status = new Map<string, PoolStatusInfo>();
    for (const [poolName, pool] of this.pools.entries()) {
      status.set(poolName, pool.getStatus());
    }
    return status;
  }

  /**
   * Acknowledges an alert
   * @param alertId The ID of the alert
   * @param user The user acknowledging the alert
   * @returns Whether the alert was acknowledged
   */
  public acknowledgeAlert(alertId: string, user: string = 'system'): boolean {
    const alert = this.alerts.find(a => a.id === alertId && !a.acknowledged);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = user;
      return true;
    }
    return false;
  }

  /**
   * Implements a capacity recommendation
   * @param recommendationId The ID of the recommendation
   * @returns Whether the recommendation was implemented
   */
  public implementRecommendation(recommendationId: string): boolean {
    const recommendation = this.recommendations.find(
      r => r.id === recommendationId && !r.implemented
    );
    
    if (!recommendation) {
      return false;
    }

    // Find the pool
    const pool = this.pools.get(recommendation.poolName);
    if (!pool) {
      return false;
    }

    // Implement the recommendation
    switch (recommendation.type) {
      case RecommendationType.INCREASE_MAX_CONNECTIONS:
      case RecommendationType.DECREASE_MAX_CONNECTIONS:
        pool.setMaxPoolSize(recommendation.recommendedValue);
        break;
      
      // Other recommendation types would require more complex handling
      default:
        // Just mark as implemented without taking action
        break;
    }

    // Update the recommendation
    recommendation.implemented = true;
    recommendation.implementedAt = new Date();
    
    return true;
  }

  /**
   * Cleans up old alerts and recommendations
   */
  public cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.retentionPeriodMs;
    
    // Clean up old alerts
    let i = this.alerts.length;
    while (i--) {
      const alert = this.alerts[i];
      if (alert.timestamp.getTime() < cutoff && 
          (alert.acknowledged || this.config.autoAcknowledgeAlerts)) {
        this.alerts.splice(i, 1);
      }
    }
    
    // Clean up old recommendations
    i = this.recommendations.length;
    while (i--) {
      const recommendation = this.recommendations[i];
      if (recommendation.timestamp.getTime() < cutoff && recommendation.implemented) {
        this.recommendations.splice(i, 1);
      }
    }
    
    // Clean up alert history
    for (const [key, timestamp] of this.alertHistory.entries()) {
      if (timestamp.getTime() < cutoff) {
        this.alertHistory.delete(key);
      }
    }
  }

  /**
   * Handles events from the connection pool
   * @param event The event data
   */
  private handlePoolEvent(event: any): void {
    const poolName = event.poolName;
    const pool = this.pools.get(poolName);
    
    if (!pool) {
      return;
    }
    
    // Update metrics
    this.metrics.set(poolName, pool.getMetrics());
    
    // Emit metrics updated event
    this.emit(MonitorEvent.METRICS_UPDATED, {
      poolName,
      metrics: this.metrics.get(poolName)
    });
    
    // Check for alerts
    if (event.type === PoolEvent.EXHAUSTED) {
      this.createAlert(
        poolName,
        AlertType.POOL_EXHAUSTION,
        AlertLevel.CRITICAL,
        `Connection pool ${poolName} is exhausted. All ${event.maxConnections} connections are in use with ${event.waitingClients} clients waiting.`,
        {
          utilization: 100,
          waitingClients: event.waitingClients,
          activeConnections: event.activeConnections,
          maxConnections: event.maxConnections
        }
      );
    } else if (event.type === PoolEvent.TIMEOUT) {
      this.createAlert(
        poolName,
        AlertType.LONG_WAIT_TIME,
        AlertLevel.WARNING,
        `Connection acquisition timed out in pool ${poolName}.`,
        {
          utilization: this.calculateUtilization(pool),
          waitingClients: this.getWaitingClients(pool),
          activeConnections: this.getActiveConnections(pool),
          maxConnections: this.getMaxConnections(pool)
        }
      );
    } else if (event.type === PoolEvent.ERROR) {
      this.createAlert(
        poolName,
        AlertType.CONNECTION_ERRORS,
        AlertLevel.WARNING,
        `Connection error in pool ${poolName}: ${event.error?.message || 'Unknown error'}`,
        {
          utilization: this.calculateUtilization(pool),
          waitingClients: this.getWaitingClients(pool),
          activeConnections: this.getActiveConnections(pool),
          maxConnections: this.getMaxConnections(pool),
          errorRate: this.calculateErrorRate(pool)
        }
      );
    }
  }

  /**
   * Checks all monitored pools for health issues
   */
  private checkPools(): void {
    for (const [poolName, pool] of this.pools.entries()) {
      const metrics = pool.getMetrics();
      const utilization = this.calculateUtilization(pool);
      const waitingClients = this.getWaitingClients(pool);
      
      // Update metrics
      this.metrics.set(poolName, metrics);
      
      // Check for high utilization
      if (utilization >= this.config.poolUtilizationThresholds.critical) {
        this.createAlert(
          poolName,
          AlertType.HIGH_UTILIZATION,
          AlertLevel.CRITICAL,
          `Connection pool ${poolName} has critical utilization at ${utilization.toFixed(1)}%.`,
          {
            utilization,
            waitingClients,
            activeConnections: this.getActiveConnections(pool),
            maxConnections: this.getMaxConnections(pool)
          }
        );
      } else if (utilization >= this.config.poolUtilizationThresholds.warning) {
        this.createAlert(
          poolName,
          AlertType.HIGH_UTILIZATION,
          AlertLevel.WARNING,
          `Connection pool ${poolName} has high utilization at ${utilization.toFixed(1)}%.`,
          {
            utilization,
            waitingClients,
            activeConnections: this.getActiveConnections(pool),
            maxConnections: this.getMaxConnections(pool)
          }
        );
      }
      
      // Check for waiting clients
      if (waitingClients >= this.config.waitingClientsThresholds.critical) {
        this.createAlert(
          poolName,
          AlertType.LONG_WAIT_TIME,
          AlertLevel.CRITICAL,
          `Connection pool ${poolName} has ${waitingClients} clients waiting for connections.`,
          {
            utilization,
            waitingClients,
            activeConnections: this.getActiveConnections(pool),
            maxConnections: this.getMaxConnections(pool)
          }
        );
      } else if (waitingClients >= this.config.waitingClientsThresholds.warning) {
        this.createAlert(
          poolName,
          AlertType.LONG_WAIT_TIME,
          AlertLevel.WARNING,
          `Connection pool ${poolName} has ${waitingClients} clients waiting for connections.`,
          {
            utilization,
            waitingClients,
            activeConnections: this.getActiveConnections(pool),
            maxConnections: this.getMaxConnections(pool)
          }
        );
      }
      
      // Check for recovery from previous critical alerts
      const hasActiveCriticalAlerts = this.alerts.some(
        alert => alert.poolName === poolName && 
                alert.level === AlertLevel.CRITICAL && 
                !alert.acknowledged
      );
      
      if (hasActiveCriticalAlerts && 
          utilization < this.config.poolUtilizationThresholds.warning && 
          waitingClients < this.config.waitingClientsThresholds.warning) {
        this.createAlert(
          poolName,
          AlertType.POOL_RECOVERY,
          AlertLevel.INFO,
          `Connection pool ${poolName} has recovered from critical state. Utilization: ${utilization.toFixed(1)}%, Waiting clients: ${waitingClients}`,
          {
            utilization,
            waitingClients,
            activeConnections: this.getActiveConnections(pool),
            maxConnections: this.getMaxConnections(pool)
          }
        );
        
        // Auto-acknowledge critical alerts for this pool
        if (this.config.autoAcknowledgeAlerts) {
          this.alerts
            .filter(alert => 
              alert.poolName === poolName && 
              alert.level === AlertLevel.CRITICAL && 
              !alert.acknowledged
            )
            .forEach(alert => {
              alert.acknowledged = true;
              alert.acknowledgedAt = new Date();
              alert.acknowledgedBy = 'system';
            });
        }
      }
    }
  }

  /**
   * Creates an alert for a pool
   * @param poolName The name of the pool
   * @param type The type of alert
   * @param level The alert level
   * @param message The alert message
   * @param metrics The metrics for the alert
   */
  private createAlert(
    poolName: string,
    type: AlertType,
    level: AlertLevel,
    message: string,
    metrics: {
      utilization: number;
      waitingClients: number;
      activeConnections: number;
      maxConnections: number;
      errorRate?: number;
      avgAcquireTime?: number;
    }
  ): void {
    // Check if we've recently created a similar alert
    const alertKey = `${poolName}:${type}:${level}`;
    const lastAlertTime = this.alertHistory.get(alertKey);
    
    if (lastAlertTime && 
        Date.now() - lastAlertTime.getTime() < this.config.alertCooldownMs) {
      return;
    }
    
    // Create the alert
    const alert: PoolAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
      poolName,
      timestamp: new Date(),
      type,
      level,
      message,
      metrics,
      acknowledged: false
    };
    
    // Add to alerts
    this.alerts.push(alert);
    
    // Update alert history
    this.alertHistory.set(alertKey, new Date());
    
    // Emit alert event
    this.emit(MonitorEvent.ALERT, alert);
    
    // Auto-acknowledge INFO alerts
    if (level === AlertLevel.INFO && this.config.autoAcknowledgeAlerts) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = 'system';
    }
  }

  /**
   * Analyzes capacity and creates recommendations
   */
  private analyzeCapacity(): void {
    for (const [poolName, pool] of this.pools.entries()) {
      const metrics = pool.getMetrics();
      const utilization = this.calculateUtilization(pool);
      const avgUtilization = this.calculateAverageUtilization(poolName);
      
      // Current pool size
      const currentMaxConnections = this.getMaxConnections(pool);
      
      // Check if we need to increase pool size
      if (avgUtilization > 80 && currentMaxConnections < 100) {
        const recommendedSize = Math.min(
          Math.ceil(currentMaxConnections * 1.5),
          100
        );
        
        this.createRecommendation(
          poolName,
          RecommendationType.INCREASE_MAX_CONNECTIONS,
          `Increase connection pool size from ${currentMaxConnections} to ${recommendedSize} due to sustained high utilization (${avgUtilization.toFixed(1)}%).`,
          currentMaxConnections,
          recommendedSize,
          0.8
        );
      }
      
      // Check if we can decrease pool size
      else if (avgUtilization < 30 && currentMaxConnections > 10) {
        const recommendedSize = Math.max(
          Math.floor(currentMaxConnections * 0.7),
          10
        );
        
        this.createRecommendation(
          poolName,
          RecommendationType.DECREASE_MAX_CONNECTIONS,
          `Decrease connection pool size from ${currentMaxConnections} to ${recommendedSize} due to sustained low utilization (${avgUtilization.toFixed(1)}%).`,
          currentMaxConnections,
          recommendedSize,
          0.6
        );
      }
      
      // Check if we need to add shards
      if (avgUtilization > 90 && metrics.waitingClients > 20) {
        this.createRecommendation(
          poolName,
          RecommendationType.ADD_SHARDS,
          `Consider adding more database shards due to sustained high pool utilization (${avgUtilization.toFixed(1)}%) and many waiting clients (${metrics.waitingClients}).`,
          1,
          2,
          0.7
        );
      }
      
      // Check if queries need optimization
      if (metrics.avgAcquireTime > 1000 && metrics.totalTimeouts > 10) {
        this.createRecommendation(
          poolName,
          RecommendationType.OPTIMIZE_QUERIES,
          `Optimize long-running queries in connection pool ${poolName}. Average acquire time: ${metrics.avgAcquireTime.toFixed(0)}ms with ${metrics.totalTimeouts} timeouts.`,
          metrics.avgAcquireTime,
          metrics.avgAcquireTime * 0.5,
          0.9
        );
      }
      
      // Check if caching would help
      if (metrics.totalAcquired > 1000 && avgUtilization > 70) {
        this.createRecommendation(
          poolName,
          RecommendationType.IMPLEMENT_CACHING,
          `Implement query caching to reduce database load. Pool ${poolName} has processed ${metrics.totalAcquired} requests with ${avgUtilization.toFixed(1)}% utilization.`,
          0,
          1,
          0.8
        );
      }
    }
    
    // Clean up old alerts and recommendations
    this.cleanup();
  }

  /**
   * Creates a capacity recommendation
   * @param poolName The name of the pool
   * @param type The type of recommendation
   * @param message The recommendation message
   * @param currentValue The current value
   * @param recommendedValue The recommended value
   * @param confidence The confidence level (0-1)
   */
  private createRecommendation(
    poolName: string,
    type: RecommendationType,
    message: string,
    currentValue: number,
    recommendedValue: number,
    confidence: number
  ): void {
    // Check if we already have a similar recommendation
    const existingRecommendation = this.recommendations.find(
      rec => rec.poolName === poolName && 
             rec.type === type && 
             !rec.implemented
    );
    
    if (existingRecommendation) {
      // Update the existing recommendation
      existingRecommendation.message = message;
      existingRecommendation.currentValue = currentValue;
      existingRecommendation.recommendedValue = recommendedValue;
      existingRecommendation.confidence = confidence;
      existingRecommendation.timestamp = new Date();
      return;
    }
    
    // Create a new recommendation
    const recommendation: CapacityRecommendation = {
      id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
      poolName,
      timestamp: new Date(),
      type,
      message,
      currentValue,
      recommendedValue,
      confidence,
      implemented: false
    };
    
    // Add to recommendations
    this.recommendations.push(recommendation);
    
    // Emit recommendation event
    this.emit(MonitorEvent.RECOMMENDATION, recommendation);
  }

  /**
   * Gets the number of waiting clients for a pool
   * @param pool The connection pool
   * @returns The number of waiting clients
   */
  private getWaitingClients(pool: VectorConnectionPool): number {
    return pool.getStatus().waitingClients || 0;
  }

  /**
   * Gets the number of active connections for a pool
   * @param pool The connection pool
   * @returns The number of active connections
   */
  private getActiveConnections(pool: VectorConnectionPool): number {
    return pool.getStatus().inUse || 0;
  }

  /**
   * Gets the maximum number of connections for a pool
   * @param pool The connection pool
   * @returns The maximum number of connections
   */
  private getMaxConnections(pool: VectorConnectionPool): number {
    return pool.getStatus().maxSize || 0;
  }

  /**
   * Calculates the utilization percentage for a pool
   * @param pool The connection pool
   * @returns The utilization percentage (0-100)
   */
  private calculateUtilization(pool: VectorConnectionPool): number {
    const status = pool.getStatus();
    if (status.maxSize === 0) {
      return 0;
    }
    return (status.inUse / status.maxSize) * 100;
  }

  /**
   * Calculates the error rate for a pool
   * @param pool The connection pool
   * @returns The error rate (0-1)
   */
  private calculateErrorRate(pool: VectorConnectionPool): number {
    const metrics = pool.getMetrics();
    const total = metrics.totalAcquired || 0;
    if (total === 0) {
      return 0;
    }
    return (metrics.totalErrors || 0) / total;
  }

  /**
   * Calculates the average utilization over time for a pool
   * @param poolName The name of the pool
   * @returns The average utilization percentage (0-100)
   */
  private calculateAverageUtilization(poolName: string): number {
    // This would normally use a time-series database or in-memory buffer
    // For now, just return the current utilization
    const pool = this.pools.get(poolName);
    if (!pool) {
      return 0;
    }
    return this.calculateUtilization(pool);
  }
}