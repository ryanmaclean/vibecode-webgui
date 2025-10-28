/**
 * Redis Configuration for AgentAPI Integration
 *
 * Optimized connection pooling and caching strategies
 * for agent session management at scale.
 *
 * Targets:
 * - 10,000+ active sessions
 * - <50ms P95 session lookups
 * - Zero data loss on agent crashes
 */

import { RedisOptions } from 'ioredis';

// =====================================================
// Connection Pool Configuration
// =====================================================

/**
 * Redis connection pool settings for high-concurrency agent operations
 */
export const AGENT_REDIS_POOL_CONFIG: RedisOptions = {
  // Connection settings
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_AGENT_DB || '1'), // Dedicated DB for agent data

  // Performance optimization
  enableReadyCheck: false,
  lazyConnect: true,
  keepAlive: 30000, // 30 seconds

  // Timeouts
  connectTimeout: 10000, // 10 seconds
  commandTimeout: 5000,  // 5 seconds (fast fail)

  // Retry strategy
  retryStrategy: (times: number) => {
    const maxDelay = 3000; // 3 seconds max
    const delay = Math.min(times * 100, maxDelay);
    return delay;
  },

  // Reconnect on error
  reconnectOnError: (err: Error) => {
    const targetErrors = ['READONLY', 'ECONNRESET'];
    return targetErrors.some(targetError => err.message.includes(targetError));
  },

  // Connection pool (for high concurrency)
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,

  // TLS for production
  ...(process.env.REDIS_TLS_ENABLED === 'true' && {
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  }),
};

// =====================================================
// Cache Strategy Configuration
// =====================================================

/**
 * TTL configuration for different data types
 * Optimized for performance vs. consistency trade-offs
 */
export const AGENT_CACHE_TTL = {
  // Hot path - frequently accessed
  SESSION_LOOKUP: 3600,        // 1 hour - agent session metadata
  WORKSPACE_AGENTS: 3600,      // 1 hour - workspace → agent mapping

  // Moderate updates
  CAPABILITIES: 300,           // 5 minutes - agent type capabilities
  HEALTH_METRICS: 300,         // 5 minutes - system health data
  CONVERSATION_CONTEXT: 600,   // 10 minutes - recent message context
  CONNECTIONS: 1800,           // 30 minutes - active WebSocket connections

  // Short-lived
  RATE_LIMIT_WINDOW: 60,       // 60 seconds - sliding window counters
  ACTIVITY_TIMESTAMP: 300,     // 5 minutes - last activity tracking

  // Long-lived
  QUOTA_CACHE: 7200,           // 2 hours - user/workspace quotas
} as const;

/**
 * Rate limiting configuration per entity
 */
export const AGENT_RATE_LIMITS = {
  // Per-user limits
  MESSAGES_PER_MINUTE: 30,
  AGENTS_PER_WORKSPACE: 3,
  WORKSPACES_PER_USER: 10,
  CONNECTIONS_PER_AGENT: 5,

  // Per-workspace limits
  MESSAGES_PER_HOUR: 1000,
  TOKENS_PER_HOUR: 100000,

  // Global limits
  MAX_ACTIVE_AGENTS: 10000,
  MAX_MESSAGES_PER_SECOND: 100,
} as const;

/**
 * Key prefixes for namespace isolation
 */
export const AGENT_REDIS_PREFIXES = {
  SESSION: 'agent:session:',
  WORKSPACE: 'agent:workspace:',
  USER: 'agent:user:',
  CAPABILITY: 'agent:capabilities:',
  RATE_LIMIT: 'agent:ratelimit:',
  CONNECTION: 'agent:connections:',
  CONTEXT: 'agent:context:',
  HEALTH: 'agent:health:',
  METRIC: 'agent:metric:',
  EVENT: 'agent:event:',
} as const;

// =====================================================
// Connection Pool Sizing
// =====================================================

/**
 * Calculate optimal connection pool size based on expected load
 */
export function calculatePoolSize(config: {
  expectedConcurrency: number;
  avgQueryLatencyMs: number;
  targetP95LatencyMs: number;
}): { min: number; max: number } {
  const { expectedConcurrency, avgQueryLatencyMs, targetP95LatencyMs } = config;

  // Little's Law: L = λ * W
  // L = avg requests in system, λ = arrival rate, W = service time
  const basePoolSize = Math.ceil(
    (expectedConcurrency * avgQueryLatencyMs) / targetP95LatencyMs
  );

  return {
    min: Math.max(2, Math.floor(basePoolSize * 0.5)),
    max: Math.max(10, Math.ceil(basePoolSize * 1.5)),
  };
}

/**
 * Default pool configuration for 10K active sessions
 */
export const DEFAULT_AGENT_POOL_SIZE = calculatePoolSize({
  expectedConcurrency: 100, // 100 concurrent operations
  avgQueryLatencyMs: 5,     // 5ms average Redis latency
  targetP95LatencyMs: 50,   // <50ms P95 target
});

// =====================================================
// Monitoring Configuration
// =====================================================

/**
 * Metrics to track for performance monitoring
 */
export const AGENT_CACHE_METRICS = {
  // Latency metrics
  SESSION_LOOKUP_DURATION: 'agent.session.lookup.duration',
  CACHE_HIT_DURATION: 'agent.cache.hit.duration',
  CACHE_MISS_DURATION: 'agent.cache.miss.duration',

  // Hit rate metrics
  SESSION_CACHE_HIT_RATE: 'agent.session.cache.hit_rate',
  CAPABILITY_CACHE_HIT_RATE: 'agent.capability.cache.hit_rate',

  // Rate limiting metrics
  RATE_LIMIT_CHECK_DURATION: 'agent.ratelimit.check.duration',
  RATE_LIMIT_BLOCKS: 'agent.ratelimit.blocks',

  // Connection metrics
  ACTIVE_CONNECTIONS: 'agent.connections.active',
  CONNECTION_POOL_SIZE: 'agent.redis.pool.size',

  // Error metrics
  CACHE_ERRORS: 'agent.cache.errors',
  REDIS_CONNECTION_ERRORS: 'agent.redis.connection.errors',
} as const;

/**
 * Performance targets for alerting
 */
export const AGENT_PERFORMANCE_TARGETS = {
  SESSION_LOOKUP_P95_MS: 50,
  CACHE_HIT_RATE_MIN: 0.90,          // 90% minimum hit rate
  RATE_LIMIT_CHECK_P95_MS: 10,
  MAX_ERROR_RATE: 0.01,              // 1% maximum error rate
  CONNECTION_POOL_UTILIZATION_MAX: 0.80, // 80% max utilization
} as const;

// =====================================================
// Backup & Recovery Configuration
// =====================================================

/**
 * Redis persistence settings for durability
 */
export const AGENT_PERSISTENCE_CONFIG = {
  // AOF (Append-Only File) for durability
  AOF_ENABLED: process.env.REDIS_AOF_ENABLED !== 'false',
  AOF_FSYNC: process.env.REDIS_AOF_FSYNC || 'everysec', // always, everysec, no

  // RDB snapshots
  RDB_ENABLED: process.env.REDIS_RDB_ENABLED !== 'false',
  RDB_SAVE_INTERVALS: [
    { seconds: 900, changes: 1 },     // Save after 900s if 1+ key changed
    { seconds: 300, changes: 10 },    // Save after 300s if 10+ keys changed
    { seconds: 60, changes: 10000 },  // Save after 60s if 10000+ keys changed
  ],
} as const;

/**
 * Backup strategy for zero data loss
 */
export const AGENT_BACKUP_STRATEGY = {
  // Automatic failover to replica
  REPLICA_ENABLED: process.env.REDIS_REPLICA_ENABLED === 'true',
  REPLICA_READ_ONLY: true,

  // Snapshot frequency
  SNAPSHOT_INTERVAL_SECONDS: 300, // 5 minutes

  // Archive old data
  ARCHIVE_SESSIONS_AFTER_DAYS: 90,
  ARCHIVE_METRICS_AFTER_DAYS: 30,
  ARCHIVE_EVENTS_AFTER_DAYS: 90,
} as const;

// =====================================================
// Environment-Specific Overrides
// =====================================================

/**
 * Get environment-specific Redis configuration
 */
export function getAgentRedisConfig(env: string = process.env.NODE_ENV || 'development') {
  const baseConfig = AGENT_REDIS_POOL_CONFIG;

  switch (env) {
    case 'production':
      return {
        ...baseConfig,
        // Stricter timeouts in production
        connectTimeout: 5000,
        commandTimeout: 3000,
        // TLS required
        tls: {
          rejectUnauthorized: true,
        },
        // More aggressive retry
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
      };

    case 'staging':
      return {
        ...baseConfig,
        // Moderate timeouts
        connectTimeout: 8000,
        commandTimeout: 4000,
      };

    case 'development':
    case 'test':
      return {
        ...baseConfig,
        // Relaxed timeouts for local dev
        connectTimeout: 15000,
        commandTimeout: 10000,
        // No TLS in dev
        tls: undefined,
      };

    default:
      return baseConfig;
  }
}

// =====================================================
// Query Optimization Hints
// =====================================================

/**
 * Redis command complexity guidelines
 * Use these to make informed caching decisions
 */
export const REDIS_COMMAND_COMPLEXITY = {
  // O(1) - Fast operations
  GET: 'O(1)',
  SET: 'O(1)',
  DEL: 'O(1)',
  EXISTS: 'O(1)',
  INCR: 'O(1)',
  HGET: 'O(1)',
  HSET: 'O(1)',

  // O(N) - Moderate operations (N = elements)
  MGET: 'O(N)',
  MSET: 'O(N)',
  HDEL: 'O(N)',
  SADD: 'O(N)',
  SREM: 'O(N)',
  SMEMBERS: 'O(N)',

  // O(N) - Expensive operations (avoid in hot path)
  KEYS: 'O(N) - AVOID IN PRODUCTION',
  SCAN: 'O(N) - Use with MATCH for filtering',
} as const;

/**
 * Best practices for high-performance caching
 */
export const AGENT_CACHE_BEST_PRACTICES = {
  // Key design
  USE_PREFIXES: 'Always use prefixes for namespace isolation',
  KEY_LENGTH: 'Keep keys under 256 bytes',
  AVOID_KEYS_COMMAND: 'Use SCAN instead of KEYS in production',

  // Value design
  SERIALIZE_JSON: 'Use JSON for complex objects',
  COMPRESS_LARGE_VALUES: 'Compress values > 1KB',
  MAX_VALUE_SIZE: '512KB recommended, 512MB hard limit',

  // TTL strategy
  ALWAYS_SET_TTL: 'Every key should have expiration',
  USE_PASSIVE_EVICTION: 'Let Redis handle expiration',
  REFRESH_ON_ACCESS: 'Update TTL on cache hits for hot data',

  // Connection pooling
  REUSE_CONNECTIONS: 'Use connection pooling, avoid creating new clients',
  PIPELINE_BATCH_OPS: 'Use pipeline for multiple operations',
  MONITOR_POOL_SIZE: 'Adjust pool size based on metrics',
} as const;

// =====================================================
// Export Configuration
// =====================================================

export default {
  pool: AGENT_REDIS_POOL_CONFIG,
  ttl: AGENT_CACHE_TTL,
  rateLimits: AGENT_RATE_LIMITS,
  prefixes: AGENT_REDIS_PREFIXES,
  poolSize: DEFAULT_AGENT_POOL_SIZE,
  metrics: AGENT_CACHE_METRICS,
  targets: AGENT_PERFORMANCE_TARGETS,
  persistence: AGENT_PERSISTENCE_CONFIG,
  backup: AGENT_BACKUP_STRATEGY,
  getConfig: getAgentRedisConfig,
};
