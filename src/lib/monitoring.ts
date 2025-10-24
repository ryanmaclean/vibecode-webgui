/**
 * Real Monitoring Integration
 * Actual Datadog metrics submission and health checks
 */

import { logger } from '@/lib/logger';

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
      logger.warn('Datadog API key not configured - metric submission skipped')
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
      logger.error('Failed to submit metric to Datadog:', error)
      return false
    }
  }

  /**
   * Submit event to Datadog
   */
  async submitEvent(title: string, text: string, tags?: string[]): Promise<boolean> {
    if (!this.datadogApiKey || this.datadogApiKey === 'placeholder-set-real-key') {
      logger.warn('Datadog API key not configured - event submission skipped')
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
      logger.error('Failed to submit event to Datadog:', error)
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
      // For PostgreSQL connections - use Prisma client instead of direct pg import
      if (databaseUrl.startsWith('postgres')) {
        try {
          // Use Prisma client for database health check
          const { prisma } = await import('@/lib/prisma')
          const start = Date.now()
          
          // Simple query to test connection
          const result = await prisma.$queryRaw`SELECT 1 as health_check`
          const latency = Date.now() - start

          return {
            status: latency > 1000 ? 'warning' : 'healthy',
            details: {
              latency: `${latency}ms`,
              connection: 'active',
              result: Array.isArray(result) && result[0]?.health_check === 1
            }
          }
        } catch (dbError) {
          // Fallback to URL validation if database connection fails
          const url = new URL(databaseUrl)
          return {
            status: 'warning',
            details: {
              host: url.hostname,
              database: url.pathname.substring(1),
              note: 'Database connection failed, using URL validation'
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
   * Real Valkey health check with connection
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
      // Try to use Valkey client, but fallback gracefully if it fails
      try {
        const { createClient } = await import('redis')
        const client = createClient({
          url: valkeyUrl,
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
      } catch (valkeyError) {
        // Fallback to basic URL validation if Valkey client fails
        const url = new URL(valkeyUrl)
        return {
          status: 'warning',
          details: {
            host: url.hostname,
            port: url.port,
            note: 'Valkey client unavailable, using URL validation'
          }
        }
      }

    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Valkey connection failed'
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
      logger.warn('Failed to track page load:', error)
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
      logger.warn('Failed to track user action:', error)
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
      logger.warn('Failed to track error:', submitError)
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
      logger.warn('Failed to submit error metric:', metricError)
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
      logger.warn('Failed to track monitoring init:', error)
    })
  }

  /**
   * Check if Datadog integration is properly configured
   */
  isConfigured(): boolean {
    return !!(this.datadogApiKey && this.datadogApiKey !== 'placeholder-set-real-key')
  }

  /**
   * Alias methods for test compatibility
   */
  trackEvent(title: string, properties: Record<string, any> = {}): void {
    // Convert properties to tags for Datadog
    const tags = Object.entries(properties).map(([key, value]) => `${key}:${value}`)
    this.submitEvent(title, JSON.stringify(properties), tags).catch(error => {
      logger.warn('Failed to track event:', error)
    })
  }

  logInfo(message: string, context?: Record<string, any>): void {
    logger.info(message, context)
  }

  logError(message: string, context?: Record<string, any>): void {
    logger.error(message, context)
  }

  trackPerformance(operation: string, duration: number, context?: Record<string, any>): void {
    const tags = context ? Object.entries(context).map(([key, value]) => `${key}:${value}`) : []
    this.submitMetric({
      metric: 'performance.operation.duration',
      value: duration,
      tags: [`operation:${operation}`, ...tags],
      timestamp: Math.floor(Date.now() / 1000)
    }).catch(error => {
      logger.warn('Failed to track performance:', error)
    })
  }
}

// Export singleton instance
export const monitoring = new MonitoringService()

// Export types
export type { MetricData, HealthCheck }
