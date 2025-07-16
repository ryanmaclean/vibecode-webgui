/**
 * Real Monitoring Integration
 * Actual Datadog metrics submission and health checks
 */

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
      this.datadogApiKey = process.env.DATADOG_API_KEY
      this.datadogSite = process.env.DATADOG_SITE || 'datadoghq.com'
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
   * Real database health check with connection pooling
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
      // For PostgreSQL connections
      if (databaseUrl.startsWith('postgres')) {
        try {
          const { Pool } = await import('pg')
          const pool = new Pool({
            connectionString: databaseUrl,
            max: 1,
            connectionTimeoutMillis: 5000,
            idleTimeoutMillis: 1000
          })

          const start = Date.now()
          const client = await pool.connect()
          
          try {
            const result = await client.query('SELECT 1 as health_check')
            const latency = Date.now() - start
            
            return {
              status: latency > 1000 ? 'warning' : 'healthy',
              details: {
                latency: `${latency}ms`,
                connection: 'active',
                result: result.rows[0]?.health_check === 1
              }
            }
          } finally {
            client.release()
            await pool.end()
          }
        } catch (pgError) {
          // Fallback to URL validation if pg module fails
          const url = new URL(databaseUrl)
          return {
            status: 'warning',
            details: {
              host: url.hostname,
              database: url.pathname.substring(1),
              note: 'PostgreSQL module unavailable, using URL validation'
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
   * Real Redis health check with connection
   */
  async checkRedis(): Promise<HealthCheck> {
    // Server-side only check
    if (typeof window !== 'undefined') {
      return {
        status: 'healthy',
        details: 'Redis check skipped (client-side)'
      }
    }

    const redisUrl = process.env.REDIS_URL
    
    if (!redisUrl) {
      return {
        status: 'healthy',
        details: 'Redis not configured (using memory storage)'
      }
    }

    try {
      const { createClient } = await import('redis')
      const client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000
        }
      })

      const start = Date.now()
      await client.connect()
      
      try {
        const pong = await client.ping()
        const latency = Date.now() - start
        
        return {
          status: latency > 1000 ? 'warning' : 'healthy',
          details: {
            latency: `${latency}ms`,
            response: pong,
            connection: 'active'
          }
        }
      } finally {
        await client.disconnect()
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
   * Check if Datadog integration is properly configured
   */
  isConfigured(): boolean {
    return !!(this.datadogApiKey && this.datadogApiKey !== 'placeholder-set-real-key')
  }
}

// Export singleton instance
export const monitoring = new MonitoringService()

// Export types
export type { MetricData, HealthCheck }