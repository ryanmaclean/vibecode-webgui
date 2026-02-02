/**
 * Global connection pool configuration
 * Centralized configuration for all database connection pools
 */

import { PoolConnectionBudget } from './connection-pool-types';

/**
 * Global pool configuration interface
 */
export interface GlobalPoolConfiguration {
  // Global Limits
  /** Maximum connections PostgreSQL allows (default: 100) */
  postgresMaxConnections: number;
  /** Total budget limit across all pools (default: 70% of postgres max) */
  totalBudgetLimit: number;
  /** Reserve capacity for emergency and other consumers */
  reserveCapacity: number;

  // Pool Budgets
  /** Budget allocation per pool */
  budgets: {
    [poolName: string]: PoolConnectionBudget;
  };

  // Thresholds
  thresholds: {
    /** Utilization threshold for warning alert (0-1) */
    capacityWarning: number;
    /** Utilization threshold for critical alert (0-1) */
    capacityCritical: number;
    /** Utilization threshold for exhaustion risk (0-1) */
    capacityExhaustion: number;
    /** Slow acquisition time threshold in ms */
    slowAcquisitionMs: number;
    /** Connection leak detection threshold in ms */
    leakDetectionMs: number;
  };

  // Circuit Breaker
  circuitBreaker: {
    /** Number of failures before opening circuit */
    failureThreshold: number;
    /** Time to wait before attempting recovery (ms) */
    timeoutMs: number;
    /** Number of successes needed to close circuit */
    successThreshold: number;
  };

  // Health Checks
  healthCheck: {
    /** Interval between health checks (ms) */
    intervalMs: number;
    /** Health check timeout (ms) */
    timeoutMs: number;
    /** Consecutive failures before marking unhealthy */
    consecutiveFailuresThreshold: number;
  };

  // Monitoring
  monitoring: {
    /** Enable detailed metrics collection */
    enableDetailedMetrics: boolean;
    /** Enable leak detection */
    enableLeakDetection: boolean;
    /** Metrics collection interval (ms) */
    metricsIntervalMs: number;
  };

  // Connection Reuse Optimization
  connectionReuse: {
    /** Enable connection reuse optimization */
    enabled: boolean;
    /** Maximum age of a connection before forced recycling (ms) */
    maxConnectionAgeMs: number;
    /** Prefer recently used connections (warm connections) */
    preferWarmConnections: boolean;
    /** Maximum idle time before connection is considered stale (ms) */
    maxIdleTimeMs: number;
    /** Enable connection validation before reuse */
    validateBeforeReuse: boolean;
    /** Validation query timeout (ms) */
    validationTimeoutMs: number;
  };

  // Adaptive Timeouts
  adaptiveTimeouts: {
    /** Enable adaptive timeout adjustment */
    enabled: boolean;
    /** Base acquire timeout (ms) */
    baseAcquireTimeoutMs: number;
    /** Maximum acquire timeout under load (ms) */
    maxAcquireTimeoutMs: number;
    /** Utilization threshold to start increasing timeout */
    loadThreshold: number;
  };
}

/**
 * Default global configuration
 */
export const DEFAULT_GLOBAL_CONFIG: GlobalPoolConfiguration = {
  // Global Limits
  postgresMaxConnections: 100,
  totalBudgetLimit: 70,
  reserveCapacity: 30,

  // Pool Budgets
  budgets: {
    'general-prisma-pool': {
      min: 2,
      max: 40,
      priority: 1,
      canBorrow: true,
      borrowed: 0
    },
    'vector-pool': {
      min: 1,
      max: 30,
      priority: 2,
      canBorrow: true,
      borrowed: 0
    }
  },

  // Thresholds
  thresholds: {
    capacityWarning: 0.70,      // 70% utilization
    capacityCritical: 0.85,     // 85% utilization
    capacityExhaustion: 0.95,   // 95% utilization
    slowAcquisitionMs: 1000,    // 1 second
    leakDetectionMs: 300000     // 5 minutes
  },

  // Circuit Breaker
  circuitBreaker: {
    failureThreshold: 5,
    timeoutMs: 60000,           // 1 minute
    successThreshold: 2
  },

  // Health Checks
  healthCheck: {
    intervalMs: 30000,          // 30 seconds
    timeoutMs: 5000,            // 5 seconds
    consecutiveFailuresThreshold: 3
  },

  // Monitoring
  monitoring: {
    enableDetailedMetrics: true,
    enableLeakDetection: true,
    metricsIntervalMs: 60000    // 1 minute
  },

  // Connection Reuse Optimization
  connectionReuse: {
    enabled: true,
    maxConnectionAgeMs: 30 * 60 * 1000, // 30 minutes max connection age
    preferWarmConnections: true,         // Prefer recently used connections
    maxIdleTimeMs: 60000,                // 1 minute max idle before stale
    validateBeforeReuse: true,           // Validate before reuse
    validationTimeoutMs: 3000            // 3 second validation timeout
  },

  // Adaptive Timeouts
  adaptiveTimeouts: {
    enabled: true,
    baseAcquireTimeoutMs: 5000,          // 5 seconds base
    maxAcquireTimeoutMs: 30000,          // 30 seconds max under load
    loadThreshold: 0.70                  // Start increasing timeout at 70% load
  }
};

/**
 * Environment-based configuration overrides
 */
export function getEnvironmentConfig(): Partial<GlobalPoolConfiguration> {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return {
        postgresMaxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '100', 10),
        totalBudgetLimit: parseInt(process.env.POOL_TOTAL_BUDGET || '70', 10),
        reserveCapacity: parseInt(process.env.POOL_RESERVE_CAPACITY || '30', 10),
        budgets: {
          'general-prisma-pool': {
            min: parseInt(process.env.PRISMA_POOL_MIN || '2', 10),
            max: parseInt(process.env.PRISMA_POOL_MAX || '40', 10),
            priority: 1,
            canBorrow: true,
            borrowed: 0
          },
          'vector-pool': {
            min: parseInt(process.env.VECTOR_POOL_MIN || '1', 10),
            max: parseInt(process.env.VECTOR_POOL_MAX || '30', 10),
            priority: 2,
            canBorrow: true,
            borrowed: 0
          }
        },
        monitoring: {
          enableDetailedMetrics: process.env.ENABLE_DETAILED_METRICS === 'true',
          enableLeakDetection: process.env.ENABLE_LEAK_DETECTION !== 'false',
          metricsIntervalMs: parseInt(process.env.METRICS_INTERVAL_MS || '60000', 10)
        }
      };

    case 'test':
      return {
        postgresMaxConnections: 20,
        totalBudgetLimit: 15,
        reserveCapacity: 5,
        budgets: {
          'general-prisma-pool': {
            min: 1,
            max: 8,
            priority: 1,
            canBorrow: true,
            borrowed: 0
          },
          'vector-pool': {
            min: 1,
            max: 7,
            priority: 2,
            canBorrow: true,
            borrowed: 0
          }
        },
        healthCheck: {
          intervalMs: 5000,       // Faster checks in tests
          timeoutMs: 2000,
          consecutiveFailuresThreshold: 2
        }
      };

    case 'development':
    default:
      return {
        postgresMaxConnections: 50,
        totalBudgetLimit: 35,
        reserveCapacity: 15,
        budgets: {
          'general-prisma-pool': {
            min: 2,
            max: 20,
            priority: 1,
            canBorrow: true,
            borrowed: 0
          },
          'vector-pool': {
            min: 1,
            max: 15,
            priority: 2,
            canBorrow: true,
            borrowed: 0
          }
        },
        monitoring: {
          enableDetailedMetrics: true,
          enableLeakDetection: true,
          metricsIntervalMs: 30000  // More frequent in dev
        }
      };
  }
}

/**
 * Merge default config with environment overrides
 */
export function getGlobalConfig(): GlobalPoolConfiguration {
  const envConfig = getEnvironmentConfig();

  return {
    ...DEFAULT_GLOBAL_CONFIG,
    ...envConfig,
    budgets: {
      ...DEFAULT_GLOBAL_CONFIG.budgets,
      ...(envConfig.budgets || {})
    },
    thresholds: {
      ...DEFAULT_GLOBAL_CONFIG.thresholds,
      ...(envConfig.thresholds || {})
    },
    circuitBreaker: {
      ...DEFAULT_GLOBAL_CONFIG.circuitBreaker,
      ...(envConfig.circuitBreaker || {})
    },
    healthCheck: {
      ...DEFAULT_GLOBAL_CONFIG.healthCheck,
      ...(envConfig.healthCheck || {})
    },
    monitoring: {
      ...DEFAULT_GLOBAL_CONFIG.monitoring,
      ...(envConfig.monitoring || {})
    },
    connectionReuse: {
      ...DEFAULT_GLOBAL_CONFIG.connectionReuse,
      ...(envConfig.connectionReuse || {})
    },
    adaptiveTimeouts: {
      ...DEFAULT_GLOBAL_CONFIG.adaptiveTimeouts,
      ...(envConfig.adaptiveTimeouts || {})
    }
  };
}

/**
 * Calculate adaptive acquire timeout based on current pool utilization
 * Returns adjusted timeout in milliseconds
 */
export function calculateAdaptiveTimeout(
  currentUtilization: number,
  config: GlobalPoolConfiguration = getGlobalConfig()
): number {
  if (!config.adaptiveTimeouts.enabled) {
    return config.adaptiveTimeouts.baseAcquireTimeoutMs;
  }

  const { baseAcquireTimeoutMs, maxAcquireTimeoutMs, loadThreshold } = config.adaptiveTimeouts;

  // If under load threshold, use base timeout
  if (currentUtilization < loadThreshold) {
    return baseAcquireTimeoutMs;
  }

  // Calculate scaled timeout based on utilization above threshold
  // Linear scaling from base to max as utilization goes from threshold to 100%
  const utilizationAboveThreshold = currentUtilization - loadThreshold;
  const utilizationRange = 1 - loadThreshold;
  const scaleFactor = Math.min(1, utilizationAboveThreshold / utilizationRange);

  const timeoutRange = maxAcquireTimeoutMs - baseAcquireTimeoutMs;
  const additionalTimeout = timeoutRange * scaleFactor;

  return Math.round(baseAcquireTimeoutMs + additionalTimeout);
}

/**
 * Find best connection for reuse based on connection reuse optimization settings
 * Returns connection key or null if no suitable connection found
 */
export function findBestConnectionForReuse(
  connections: Map<string, { lastUsed: number; createdAt: number; inUse: boolean }>,
  config: GlobalPoolConfiguration = getGlobalConfig()
): string | null {
  if (!config.connectionReuse.enabled) {
    return null;
  }

  const now = Date.now();
  const { maxConnectionAgeMs, preferWarmConnections, maxIdleTimeMs } = config.connectionReuse;

  let bestConnection: string | null = null;
  let bestScore = -Infinity;

  for (const [key, conn] of connections.entries()) {
    // Skip in-use connections
    if (conn.inUse) continue;

    const age = now - conn.createdAt;
    const idleTime = now - conn.lastUsed;

    // Skip connections that are too old
    if (age > maxConnectionAgeMs) continue;

    // Skip connections that have been idle too long (stale)
    if (idleTime > maxIdleTimeMs) continue;

    // Calculate score based on preferences
    let score = 0;

    if (preferWarmConnections) {
      // Prefer recently used connections (lower idle time = higher score)
      // Score inversely proportional to idle time
      score = maxIdleTimeMs - idleTime;
    } else {
      // Prefer least recently used (for more even connection usage)
      score = idleTime;
    }

    // Penalize very old connections slightly
    const ageRatio = age / maxConnectionAgeMs;
    score = score * (1 - ageRatio * 0.2); // Up to 20% penalty for old connections

    if (score > bestScore) {
      bestScore = score;
      bestConnection = key;
    }
  }

  return bestConnection;
}

/**
 * Validate configuration consistency
 */
export function validateConfig(config: GlobalPoolConfiguration): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check total budget doesn't exceed capacity
  const totalBudgeted = Object.values(config.budgets).reduce((sum, budget) => sum + budget.max, 0);
  if (totalBudgeted > config.totalBudgetLimit) {
    errors.push(
      `Total budgeted (${totalBudgeted}) exceeds total budget limit (${config.totalBudgetLimit})`
    );
  }

  // Check budget limit + reserve doesn't exceed postgres max
  if (config.totalBudgetLimit + config.reserveCapacity > config.postgresMaxConnections) {
    errors.push(
      `Budget limit (${config.totalBudgetLimit}) + reserve (${config.reserveCapacity}) ` +
      `exceeds PostgreSQL max (${config.postgresMaxConnections})`
    );
  }

  // Check each pool budget
  for (const [poolName, budget] of Object.entries(config.budgets)) {
    if (budget.min > budget.max) {
      errors.push(`Pool "${poolName}": min (${budget.min}) > max (${budget.max})`);
    }
    if (budget.min < 0 || budget.max < 0) {
      errors.push(`Pool "${poolName}": negative budget values not allowed`);
    }
    if (budget.priority < 0) {
      errors.push(`Pool "${poolName}": negative priority not allowed`);
    }
  }

  // Check thresholds are in valid range
  const thresholds = config.thresholds;
  if (thresholds.capacityWarning < 0 || thresholds.capacityWarning > 1) {
    errors.push('capacityWarning threshold must be between 0 and 1');
  }
  if (thresholds.capacityCritical < 0 || thresholds.capacityCritical > 1) {
    errors.push('capacityCritical threshold must be between 0 and 1');
  }
  if (thresholds.capacityExhaustion < 0 || thresholds.capacityExhaustion > 1) {
    errors.push('capacityExhaustion threshold must be between 0 and 1');
  }
  if (thresholds.capacityWarning >= thresholds.capacityCritical) {
    errors.push('capacityWarning must be less than capacityCritical');
  }
  if (thresholds.capacityCritical >= thresholds.capacityExhaustion) {
    errors.push('capacityCritical must be less than capacityExhaustion');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
