/**
 * Database and Redis connection configuration with environment variable support
 * Provides sensible defaults and environment-specific settings
 */

/**
 * Database connection pool configuration
 */
export interface DatabasePoolConfig {
  min?: number
  max?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
  acquireTimeoutMillis?: number
  enableDynamicSizing?: boolean
  enableConnectionValidation?: boolean
}

/**
 * Redis connection configuration
 */
export interface RedisConnectionConfig {
  connectTimeout?: number
  commandTimeout?: number
  retryDelayOnFailover?: number
  maxRetriesPerRequest?: number
  lazyConnect?: boolean
  enableAutoPipelining?: boolean
  keepAlive?: number
}

/**
 * Get database pool configuration from environment variables
 */
export function getDatabasePoolConfig(): DatabasePoolConfig {
  return {
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '10000', 10),
    acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '60000', 10),
    enableDynamicSizing: process.env.DB_POOL_ENABLE_DYNAMIC_SIZING !== 'false',
    enableConnectionValidation: process.env.DB_POOL_ENABLE_CONNECTION_VALIDATION !== 'false'
  }
}

/**
 * Get Redis connection configuration from environment variables
 */
export function getRedisConnectionConfig(): RedisConnectionConfig {
  return {
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000', 10),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '3000', 10),
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
    lazyConnect: process.env.REDIS_LAZY_CONNECT === 'true',
    enableAutoPipelining: process.env.REDIS_ENABLE_PIPELINING !== 'false',
    keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE || '30000', 10)
  }
}

/**
 * Get database connection string with proper configuration
 */
export function getDatabaseUrl(): string | null {
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    return null
  }

  // Don't modify URLs that already have query parameters configured
  if (databaseUrl.includes('?')) {
    return databaseUrl
  }

  // Add connection pool and other settings for PostgreSQL
  if (databaseUrl.startsWith('postgres')) {
    const url = new URL(databaseUrl)
    const poolConfig = getDatabasePoolConfig()
    
    // Add connection pool settings
    url.searchParams.set('pool_min_conns', poolConfig.min?.toString() || '2')
    url.searchParams.set('pool_max_conns', poolConfig.max?.toString() || '10')
    url.searchParams.set('pool_timeout', Math.floor((poolConfig.acquireTimeoutMillis || 60000) / 1000).toString())
    
    // Add application name for monitoring
    url.searchParams.set('application_name', 'vibecode-webgui')
    
    // Add SSL mode if not specified
    if (!url.searchParams.has('sslmode')) {
      const isProduction = process.env.NODE_ENV === 'production'
      url.searchParams.set('sslmode', isProduction ? 'require' : 'prefer')
    }
    
    return url.toString()
  }
  
  return databaseUrl
}

/**
 * Get Redis connection string with proper configuration
 */
export function getRedisUrl(): string | null {
  const redisUrl = process.env.REDIS_URL
  
  if (!redisUrl) {
    return null
  }

  // Return as-is if it already has query parameters or is not a redis:// URL
  if (redisUrl.includes('?') || !redisUrl.startsWith('redis://')) {
    return redisUrl
  }

  const url = new URL(redisUrl)
  const config = getRedisConnectionConfig()
  
  // Add timeout settings as query parameters (Redis URL format)
  url.searchParams.set('connectTimeout', config.connectTimeout?.toString() || '5000')
  url.searchParams.set('commandTimeout', config.commandTimeout?.toString() || '3000')
  
  return url.toString()
}

/**
 * Get connection status summary
 */
export function getConnectionStatus() {
  const dbUrl = getDatabaseUrl()
  const redisUrl = getRedisUrl()
  
  return {
    database: {
      configured: !!dbUrl,
      url: dbUrl ? `${new URL(dbUrl).protocol}//${new URL(dbUrl).host}/${new URL(dbUrl).pathname.substring(1)}` : null,
      poolConfig: getDatabasePoolConfig()
    },
    redis: {
      configured: !!redisUrl,
      url: redisUrl ? `${new URL(redisUrl).protocol}//${new URL(redisUrl).host}` : null,
      connectionConfig: getRedisConnectionConfig()
    }
  }
}