/**
 * Real Monitoring Integration
 * Actual Datadog metrics submission and health checks
 */

import { getDatadogApiKey, getDatadogSite } from './monitoring/datadog-env'

interface MetricData {
  metric: string
  value: number
  tags?: string[]
  timestamp?: number
}

interface HealthCheck {
  status: 'healthy' | 'warning' | 'error'
  details?: any
  error?: string
}

class MonitoringService {
  private datadogApiKey: string | undefined
  private datadogSite: string
  private baseUrl: string

  constructor() {
    // Only initialize on server-side
    if (typeof window === 'undefined') {
      this.datadogApiKey = getDatadogApiKey()
      this.datadogSite = getDatadogSite()
      this.baseUrl = `https://api.${this.datadogSite}/api/v1`
    } else {
      this.datadogApiKey = undefined
      this.datadogSite = 'datadoghq.com'
      this.baseUrl = `https://api.${this.datadogSite}/api/v1`
    }
  }

  /**
   * Submit metrics to Datadog
   */
  async submitMetric(metric: MetricData): Promise<boolean> {
    if (!this.datadogApiKey || this.datadogApiKey === 'placeholder-set-real-key') {
      console.warn('Datadog API key not configured - metric submission skipped')
      return false
    }

    try {
      const response = await fetch(`${this.baseUrl}/series`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.datadogApiKey
        },
        body: JSON.stringify({
          series: [{
            metric: metric.metric,
            points: [[metric.timestamp || Date.now() / 1000, metric.value]],
            tags: metric.tags || [],
            host: 'vibecode-webgui',
            type: 'gauge'
          }]
        })
      })

      if (!response.ok) {
        throw new Error(`Datadog API error: ${response.status} ${response.statusText}`)
      }

      return true
    } catch (error) {
      console.error('Failed to submit metric to Datadog:', error)
      return false
    }
  }

  /**
   * Submit event to Datadog
   */
  async submitEvent(title: string, text: string, tags?: string[]): Promise<boolean> {
    if (!this.datadogApiKey || this.datadogApiKey === 'placeholder-set-real-key') {
      console.warn('Datadog API key not configured - event submission skipped')
      return false
    }

    try {
      const response = await fetch(`${this.baseUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.datadogApiKey
        },
        body: JSON.stringify({
          title,
          text,
          tags: tags || [],
          source_type_name: 'vibecode-webgui',
          alert_type: 'info'
        })
      })

      if (!response.ok) {
        throw new Error(`Datadog API error: ${response.status} ${response.statusText}`)
      }

      return true
    } catch (error) {
      console.error('Failed to submit event to Datadog:', error)
      return false
    }
  }

  /**
   * Real database health check with connection pooling and improved fallback
   */
  async checkDatabase(): Promise<HealthCheck> {
    // Server-side only check
    if (typeof window !== 'undefined') {
      return {
        status: 'healthy',
        details: 'Database check skipped (client-side)'
      }
    }

    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      return {
        status: 'healthy',
        details: 'Database not configured (using file storage)'
      }
    }

    try {
      // For PostgreSQL connections - try multiple approaches
      if (databaseUrl.startsWith('postgres')) {
        // First, try Prisma client
        try {
          const { prisma } = await import('../prisma')
          const start = Date.now()
          
          // Simple query to test connection
          const result = await prisma.$queryRaw`SELECT 1 as health_check`
          const latency = Date.now() - start

          return {
            status: latency > 1000 ? 'warning' : 'healthy',
            details: {
              latency: `${latency}ms`,
              connection: 'active via Prisma',
              result: Array.isArray(result) && result[0]?.health_check === 1
            }
          }
        } catch (prismaError) {
          // Fallback to direct pg connection if Prisma fails
          try {
            const { Pool } = await import('pg')
            const pool = new Pool({
              connectionString: databaseUrl,
              max: 1, // Single connection for health check
              connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '5000', 10),
              idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '1000', 10),
              allowExitOnIdle: true
            })

            const start = Date.now()
            const client = await pool.connect()

            try {
              const result = await client.query('SELECT 1 as health_check')
              const latency = Date.now() - start

              await client.release()
              await pool.end()

              return {
                status: latency > 1000 ? 'warning' : 'healthy',
                details: {
                  latency: `${latency}ms`,
                  connection: 'active via pg Pool',
                  result: result.rows[0]?.health_check === 1
                }
              }
            } catch (queryError) {
              await client.release()
              await pool.end()
              throw queryError
            }
          } catch (pgError) {
            // Final fallback to URL validation with detailed error info
            const url = new URL(databaseUrl)
            return {
              status: 'error',
              details: {
                host: url.hostname,
                port: url.port || '5432',
                database: url.pathname.substring(1),
                ssl: url.searchParams.get('sslmode') === 'require',
                prismaError: prismaError instanceof Error ? prismaError.message : 'Prisma unavailable',
                pgError: pgError instanceof Error ? pgError.message : 'PostgreSQL connection failed',
                note: 'PostgreSQL module unavailable, using URL validation only'
              }
            }
          }
        }
      }

      // For other database types, basic URL validation
      const url = new URL(databaseUrl)
      return {
        status: 'healthy',
        details: {
          host: url.hostname,
          database: url.pathname.substring(1),
          ssl: url.searchParams.get('sslmode') === 'require'
        }
      }

    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Database connection failed'
      }
    }
  }

  /**
   * Real Redis health check with improved connection handling
   */
  async checkValkey(): Promise<HealthCheck> {
    // Server-side only check
    if (typeof window !== 'undefined') {
      return {
        status: 'healthy',
        details: 'Valkey check skipped (client-side)'
      }
    }

    const valkeyUrl = process.env.REDIS_URL

    if (!valkeyUrl) {
      return {
        status: 'healthy',
        details: 'Valkey not configured (using memory storage)'
      }
    }

    try {
      // Try to use Redis client with improved configuration
      try {
        const { createClient } = await import('redis')
        
        // Parse Redis URL to get connection details
        const url = new URL(valkeyUrl)
        const client = createClient({
          url: valkeyUrl,
          socket: {
            connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000', 10),
            reconnectStrategy: (retries) => {
              // Only retry once for health check
              return retries > 1 ? false : Math.min(retries * 100, 1000)
            }
          },
          // Add authentication if provided in URL
          ...(url.password ? { password: url.password } : {}),
          // Select database if specified in URL
          database: parseInt(url.pathname.replace('/', '') || '0', 10)
        })

        // Set up error handlers to prevent unhandled rejections
        client.on('error', (error) => {
          console.warn('Redis client error during health check:', error.message)
        })

        const start = Date.now()
        await client.connect()

        try {
          const pong = await client.ping()
          const latency = Date.now() - start

          // Get additional info if possible
          let info: { version?: string; mode?: string } | null = null
          try {
            const infoResult = await client.info('server')
            const infoStr = typeof infoResult === 'string' ? infoResult : String(infoResult)
            const lines = infoStr.split('\r\n')
            const version = lines.find(line => line.startsWith('redis_version:'))?.split(':')[1]
            const mode = lines.find(line => line.startsWith('redis_mode:'))?.split(':')[1]
            info = { version, mode }
          } catch (infoError) {
            // Info command might not be available, continue without it
          }

          return {
            status: latency > 1000 ? 'warning' : 'healthy',
            details: {
              latency: `${latency}ms`,
              response: pong,
              connection: 'active',
              host: url.hostname,
              port: url.port || '6379',
              database: url.pathname.replace('/', '') || '0',
              ...(info ? { info } : {})
            }
          }
        } finally {
          try {
            await client.quit()
          } catch (disconnectError) {
            // Ignore disconnect errors in health check
            console.warn('Redis disconnect warning:', disconnectError)
          }
        }
      } catch (redisError) {
        // Fallback to basic URL validation if Redis client fails
        const url = new URL(valkeyUrl)
        const errorMessage = redisError instanceof Error ? redisError.message : 'Unknown error'
        
        return {
          status: 'error',
          details: {
            host: url.hostname,
            port: url.port || '6379',
            database: url.pathname.replace('/', '') || '0',
            error: errorMessage,
            note: 'Redis connection failed, caching features unavailable'
          }
        }
      }

    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Redis connection failed'
      }
    }
  }

  /**
   * Real AI service health check with API test
   */
  async checkAIService(): Promise<HealthCheck> {
    const openRouterKey = process.env.OPENROUTER_API_KEY

    if (!openRouterKey || openRouterKey === 'test-key-placeholder') {
      return {
        status: 'warning',
        details: 'OpenRouter API key not configured'
      }
    }

    try {
      // Test actual API connectivity
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const modelCount = Array.isArray(data.data) ? data.data.length : 0

      return {
        status: 'healthy',
        details: {
          connection: 'active',
          models_available: modelCount,
          api_version: 'v1'
        }
      }

    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'AI service connection failed'
      }
    }
  }

  /**
   * Track application metrics
   */
  async trackMetrics(): Promise<void> {
    const memUsage = process.memoryUsage()

    // Submit memory metrics
    await this.submitMetric({
      metric: 'vibecode.memory.heap_used',
      value: memUsage.heapUsed / 1024 / 1024, // MB
      tags: ['service:vibecode-webgui', 'env:' + (process.env.NODE_ENV || 'development')]
    })

    await this.submitMetric({
      metric: 'vibecode.memory.heap_total',
      value: memUsage.heapTotal / 1024 / 1024, // MB
      tags: ['service:vibecode-webgui', 'env:' + (process.env.NODE_ENV || 'development')]
    })

    // Submit uptime metric
    await this.submitMetric({
      metric: 'vibecode.uptime',
      value: process.uptime(),
      tags: ['service:vibecode-webgui', 'env:' + (process.env.NODE_ENV || 'development')]
    })
  }

  /**
   * Track page load metrics
   */
  trackPageLoad(path: string, startTime: number): void {
    const loadTime = Date.now() - startTime
    
    // Submit page load metric
    this.submitMetric({
      metric: 'vibecode.page.load_time',
      value: loadTime,
      tags: [
        `page:${path}`,
        'service:vibecode-webgui',
        `env:${process.env.NODE_ENV || 'development'}`
      ]
    }).catch(error => {
      console.warn('Failed to track page load:', error)
    })
  }

  /**
   * Track user actions
   */
  trackUserAction(action: string, properties: Record<string, any> = {}): void {
    // Submit user action event
    this.submitEvent(
      `User Action: ${action}`,
      `User performed action: ${action}`,
      [
        `action:${action}`,
        'service:vibecode-webgui',
        `env:${process.env.NODE_ENV || 'development'}`,
        ...Object.entries(properties).map(([key, value]) => `${key}:${value}`)
      ]
    ).catch(error => {
      console.warn('Failed to track user action:', error)
    })
  }

  /**
   * Track errors with context
   */
  trackError(error: Error, context: Record<string, any> = {}): void {
    // Submit error event
    this.submitEvent(
      `Error: ${error.name}`,
      `${error.message}\n\nStack trace:\n${error.stack}`,
      [
        `error:${error.name.toLowerCase()}`,
        'service:vibecode-webgui',
        `env:${process.env.NODE_ENV || 'development'}`,
        ...Object.entries(context).map(([key, value]) => `${key}:${value}`)
      ]
    ).catch(submitError => {
      console.warn('Failed to track error:', submitError)
    })

    // Also submit error count metric
    this.submitMetric({
      metric: 'vibecode.errors.count',
      value: 1,
      tags: [
        `error_type:${error.name.toLowerCase()}`,
        'service:vibecode-webgui',
        `env:${process.env.NODE_ENV || 'development'}`
      ]
    }).catch(metricError => {
      console.warn('Failed to submit error metric:', metricError)
    })
  }

  /**
   * Initialize monitoring
   */
  init(): void {
    // Track initialization
    this.submitEvent(
      'Monitoring Initialized',
      'VibeCode monitoring service started',
      [
        'service:vibecode-webgui',
        `env:${process.env.NODE_ENV || 'development'}`,
        'event:monitoring_init'
      ]
    ).catch(error => {
      console.warn('Failed to track monitoring init:', error)
    })
  }

  /**
   * Check if Datadog integration is properly configured
   */
  isConfigured(): boolean {
    return !!(this.datadogApiKey && this.datadogApiKey !== 'placeholder-set-real-key')
  }
}

// Simple logger implementation
export const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args)
}

// Export singleton instance
export const monitoring = new MonitoringService()

// Export types
export type { MetricData, HealthCheck }
