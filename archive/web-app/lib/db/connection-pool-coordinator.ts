/**
 * Global Connection Pool Coordinator
 * Manages connection pools across the application
 */

import { EventEmitter } from 'events';
import { ConnectionBudget, ManagedConnectionPool } from './connection-pool-types';

export enum GlobalPoolEvent {
  GLOBAL_CAPACITY_WARNING = 'global-capacity-warning',
  GLOBAL_HEALTH_CHECK = 'global-health-check',
  CIRCUIT_BREAKER_OPENED = 'circuit-breaker-opened',
  CONNECTION_CREATED_GLOBAL = 'connection-created-global',
  CONNECTION_ACQUIRED_GLOBAL = 'connection-acquired-global',
  CONNECTION_RELEASED_GLOBAL = 'connection-released-global',
  CONNECTION_DESTROYED_GLOBAL = 'connection-destroyed-global',
  SLOW_ACQUISITION = 'slow-acquisition'
}

interface PoolBudget {
  min: number;
  max: number;
  priority: number;
  canBorrow: boolean;
  borrowed?: number;
}

interface BudgetAdjustmentRequest {
  poolName: string;
  requestedMax: number;
  reason: string;
  emergency?: boolean;
  expiresAt?: number;
}

interface BudgetAdjustmentResponse {
  approved: boolean;
  newBudget?: PoolBudget;
}

interface GlobalStatus {
  totalCapacity: number;
  totalAllocated: number;
  totalActive: number;
  utilizationPercent: number;
  reserve: {
    total: number;
    available: number;
    allocated: number;
  };
  pools: Record<string, any>;
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: Date;
  }>;
}

interface HealthCheckResult {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  pools: Record<string, any>;
  recommendations: string[];
}

interface CoordinatorConfig {
  postgresMaxConnections?: number;
  totalBudgetLimit?: number;
  reserveCapacity?: number;
  budgets?: Record<string, PoolBudget>;
  slowAcquisitionThreshold?: number;
}

export class ConnectionPoolCoordinator extends EventEmitter {
  private pools: Map<string, ManagedConnectionPool> = new Map();
  private budgets: Map<string, PoolBudget> = new Map();
  private totalConnections = 0;
  private maxGlobalConnections = 100;
  private config: CoordinatorConfig;
  private circuitBreakers: Map<string, { failures: number; lastFailure?: Date; isOpen: boolean }> = new Map();
  private budgetRestorationTimers: Map<string, NodeJS.Timeout> = new Map();
  private isClosed = false;

  constructor(config: CoordinatorConfig = {}) {
    super();

    // Validate configuration
    const postgresMaxConnections = config.postgresMaxConnections ?? 100;
    const totalBudgetLimit = config.totalBudgetLimit ?? 50;
    const reserveCapacity = config.reserveCapacity ?? 10;

    if (totalBudgetLimit > postgresMaxConnections) {
      throw new Error(`Total budget limit (${totalBudgetLimit}) cannot exceed PostgreSQL max connections (${postgresMaxConnections})`);
    }

    // Validate budgets sum if provided
    if (config.budgets) {
      const budgetsSum = Object.values(config.budgets).reduce((sum, budget) => sum + budget.max, 0);
      if (budgetsSum > totalBudgetLimit) {
        throw new Error(`Sum of pool budgets (${budgetsSum}) exceeds total budget limit (${totalBudgetLimit})`);
      }
    }

    this.config = {
      postgresMaxConnections,
      totalBudgetLimit,
      reserveCapacity,
      slowAcquisitionThreshold: 1000,
      ...config
    };

    this.maxGlobalConnections = postgresMaxConnections;

    // Initialize default budgets
    this.budgets.set('general-prisma-pool', {
      min: 1,
      max: 8,
      priority: 1,
      canBorrow: true,
      borrowed: 0
    });

    this.budgets.set('vector-pool', {
      min: 1,
      max: 7,
      priority: 2,
      canBorrow: true,
      borrowed: 0
    });
  }

  registerPool(pool: ManagedConnectionPool, budget: PoolBudget): void {
    this.pools.set(pool.name, pool);
    this.budgets.set(pool.name, { ...budget, borrowed: 0 });
    this.circuitBreakers.set(pool.name, { failures: 0, isOpen: false });
  }

  unregisterPool(name: string): void {
    this.pools.delete(name);
    this.budgets.delete(name);
    this.circuitBreakers.delete(name);
  }

  getAllPools(): Map<string, ManagedConnectionPool> {
    return new Map(this.pools);
  }

  getBudget(poolName: string): PoolBudget | undefined {
    return this.budgets.get(poolName);
  }

  requestBudgetIncrease(poolName: string, amount: number): boolean {
    const budget = this.budgets.get(poolName);
    if (!budget || !budget.canBorrow) {
      return false;
    }

    // Calculate total allocated (base budgets only, not borrowed amounts)
    const totalBaseAllocated = Array.from(this.budgets.values()).reduce(
      (sum, b) => sum + b.max,
      0
    );

    // Calculate how much is already borrowed from reserve
    const totalBorrowed = Array.from(this.budgets.values()).reduce(
      (sum, b) => sum + (b.borrowed || 0),
      0
    );

    // Reserve available is the reserve capacity minus what's already borrowed
    const reserveAvailable = (this.config.reserveCapacity || 10) - totalBorrowed;

    if (amount <= reserveAvailable) {
      budget.borrowed = (budget.borrowed || 0) + amount;
      return true;
    }

    return false;
  }

  returnBudget(poolName: string, amount: number): void {
    const budget = this.budgets.get(poolName);
    if (!budget) return;

    budget.borrowed = Math.max(0, (budget.borrowed || 0) - amount);
  }

  adjustBudget(request: BudgetAdjustmentRequest): BudgetAdjustmentResponse {
    const budget = this.budgets.get(request.poolName);
    if (!budget) {
      return { approved: false };
    }

    const increase = request.requestedMax - budget.max;
    if (increase > 0) {
      const canIncrease = this.requestBudgetIncrease(request.poolName, increase);
      if (!canIncrease) {
        return { approved: false };
      }

      // Move borrowed to max
      budget.max = request.requestedMax;
      budget.borrowed = 0;
    } else {
      budget.max = request.requestedMax;
    }

    // Handle temporary adjustments
    if (request.expiresAt) {
      const originalMax = budget.max - increase;
      const timer = setTimeout(() => {
        const currentBudget = this.budgets.get(request.poolName);
        if (currentBudget) {
          currentBudget.max = originalMax;
        }
        this.budgetRestorationTimers.delete(request.poolName);
      }, request.expiresAt - Date.now());

      this.budgetRestorationTimers.set(request.poolName, timer);
    }

    return {
      approved: true,
      newBudget: { ...budget }
    };
  }

  getGlobalStatus(): GlobalStatus {
    const totalAllocated = Array.from(this.budgets.values()).reduce(
      (sum, b) => sum + b.max,
      0
    );

    const totalBorrowed = Array.from(this.budgets.values()).reduce(
      (sum, b) => sum + (b.borrowed || 0),
      0
    );

    const reserveTotal = this.config.reserveCapacity || 10;
    const reserveAllocated = totalBorrowed;
    const reserveAvailable = reserveTotal - reserveAllocated;

    const totalCapacity = this.config.totalBudgetLimit || 50;
    const totalActive = this.totalConnections;
    const utilizationPercent = totalCapacity > 0 ? (totalActive / totalCapacity) * 100 : 0;

    const alerts: Array<{ severity: 'info' | 'warning' | 'critical'; message: string; timestamp: Date }> = [];

    // Generate alerts based on utilization
    if (utilizationPercent > 90) {
      alerts.push({
        severity: 'critical',
        message: `Critical utilization: ${utilizationPercent.toFixed(1)}%`,
        timestamp: new Date()
      });
    } else if (utilizationPercent > 75) {
      alerts.push({
        severity: 'warning',
        message: `High utilization: ${utilizationPercent.toFixed(1)}%`,
        timestamp: new Date()
      });
    }

    const pools: Record<string, any> = {};
    for (const [name, pool] of this.pools.entries()) {
      pools[name] = {
        name,
        status: pool.status,
        budget: this.budgets.get(name)
      };
    }

    return {
      totalCapacity,
      totalAllocated,
      totalActive,
      utilizationPercent,
      reserve: {
        total: reserveTotal,
        available: reserveAvailable,
        allocated: reserveAllocated
      },
      pools,
      alerts
    };
  }

  async checkGlobalHealth(): Promise<HealthCheckResult> {
    const pools: Record<string, any> = {};
    let healthyCount = 0;
    let totalCount = 0;

    for (const [name, pool] of this.pools.entries()) {
      totalCount++;
      const isHealthy = pool.status === 'active';
      if (isHealthy) healthyCount++;

      pools[name] = {
        name,
        status: pool.status,
        healthy: isHealthy
      };
    }

    const healthRatio = totalCount > 0 ? healthyCount / totalCount : 1;
    let overall: 'healthy' | 'degraded' | 'unhealthy';

    if (healthRatio >= 0.9) {
      overall = 'healthy';
    } else if (healthRatio >= 0.5) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    const recommendations: string[] = [];
    const status = this.getGlobalStatus();

    if (status.utilizationPercent > 80) {
      recommendations.push('Consider increasing connection pool limits');
    }

    if (status.reserve.available < 2) {
      recommendations.push('Reserve capacity is low, consider increasing total capacity');
    }

    const result: HealthCheckResult = {
      overall,
      timestamp: new Date(),
      pools,
      recommendations
    };

    this.emit(GlobalPoolEvent.GLOBAL_HEALTH_CHECK, result);

    return result;
  }

  isPoolAvailable(poolName: string): boolean {
    const breaker = this.circuitBreakers.get(poolName);
    if (!breaker) return true;
    return !breaker.isOpen;
  }

  reportPoolFailure(poolName: string, error: Error): void {
    let breaker = this.circuitBreakers.get(poolName);
    if (!breaker) {
      breaker = { failures: 0, isOpen: false };
      this.circuitBreakers.set(poolName, breaker);
    }

    breaker.failures++;
    breaker.lastFailure = new Date();

    // Open circuit after 5 consecutive failures
    if (breaker.failures >= 5 && !breaker.isOpen) {
      breaker.isOpen = true;
      this.emit(GlobalPoolEvent.CIRCUIT_BREAKER_OPENED, {
        poolName,
        failures: breaker.failures,
        error
      });
    }
  }

  reportConnectionCreated(poolName: string): void {
    this.totalConnections++;
    this.emit(GlobalPoolEvent.CONNECTION_CREATED_GLOBAL, { poolName });
  }

  reportConnectionAcquired(poolName: string, acquireTime: number): void {
    this.emit(GlobalPoolEvent.CONNECTION_ACQUIRED_GLOBAL, {
      poolName,
      acquireTime
    });

    const threshold = this.config.slowAcquisitionThreshold || 1000;
    if (acquireTime > threshold) {
      this.emit(GlobalPoolEvent.SLOW_ACQUISITION, {
        poolName,
        acquireTime,
        threshold
      });
    }
  }

  reportConnectionReleased(poolName: string): void {
    this.emit(GlobalPoolEvent.CONNECTION_RELEASED_GLOBAL, { poolName });
  }

  reportConnectionDestroyed(poolName: string): void {
    this.totalConnections = Math.max(0, this.totalConnections - 1);
    this.emit(GlobalPoolEvent.CONNECTION_DESTROYED_GLOBAL, { poolName });
  }

  requestConnectionBudget(poolName: string, requested: number): ConnectionBudget {
    const available = this.maxGlobalConnections - this.totalConnections;
    const granted = Math.min(requested, available);

    return {
      granted,
      available,
      total: this.maxGlobalConnections
    };
  }

  reportConnectionChange(poolName: string, delta: number): void {
    this.totalConnections += delta;
  }

  getGlobalMetrics() {
    return {
      totalPools: this.pools.size,
      totalConnections: this.totalConnections,
      maxConnections: this.maxGlobalConnections
    };
  }

  async close(): Promise<void> {
    this.isClosed = true;

    // Clear all budget restoration timers
    for (const timer of this.budgetRestorationTimers.values()) {
      clearTimeout(timer);
    }
    this.budgetRestorationTimers.clear();

    // Remove all listeners
    this.removeAllListeners();
  }
}

let globalCoordinator: ConnectionPoolCoordinator | null = null;

export function getGlobalCoordinator(config?: CoordinatorConfig): ConnectionPoolCoordinator {
  if (!globalCoordinator) {
    globalCoordinator = new ConnectionPoolCoordinator(config);
  }
  return globalCoordinator;
}

export function resetGlobalCoordinator(): void {
  if (globalCoordinator) {
    globalCoordinator.close();
    globalCoordinator = null;
  }
}
