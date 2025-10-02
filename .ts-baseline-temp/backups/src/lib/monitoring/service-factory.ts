/**
 * Monitoring Service Factory
 * Creates monitoring services based on actual production configuration
 */

import { EmbeddingServiceFactory, EmbeddingProvider } from '@/lib/ai/embeddingServiceFactory'
import { OpenRouter } from '@/lib/openrouter-client'
import { PrismaClient } from '@prisma/client'

export interface ProductionServiceMetrics {
  provider: string
  service: string
  isActive: boolean
  configuration: Record<string, any>
  healthStatus: 'healthy' | 'warning' | 'error'
  lastChecked: string
  metrics?: {
    requestCount?: number
    errorRate?: number
    avgResponseTime?: number
    uptime?: number
  }
}

export interface ServiceHealthCheck {
  service: string
  status: 'healthy' | 'warning' | 'error'
  latency?: number
  error?: string
  timestamp: string
}

/**
 * Factory for creating monitoring-aware production services
 */
export class MonitoringServiceFactory {
  private prisma: PrismaClient
  
  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * Get all active production services and their monitoring status
   */
  async getProductionServices(): Promise<ProductionServiceMetrics[]> {
    const services: ProductionServiceMetrics[] = []

    // Check embedding services (Azure/OpenAI)
    try {
      const embeddingFactory = new EmbeddingServiceFactory(this.prisma)
      const _embeddingService = embeddingFactory.createEmbeddingServiceFromEnv()
      
      // Determine which embedding provider is configured
      const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT
      const openaiKey = process.env.OPENAI_API_KEY
      
      if (azureEndpoint) {
        services.push({
          provider: 'Azure OpenAI',
          service: 'Embedding Service',
          isActive: true,
          configuration: {
            endpoint: azureEndpoint,
            deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
            useManagedIdentity: process.env.USE_AZURE_MANAGED_IDENTITY === 'true',
            useConnectionPool: process.env.USE_CONNECTION_POOL === 'true'
          },
          healthStatus: 'healthy', // Will be updated by health check
          lastChecked: new Date().toISOString()
        })
      }
      
      if (openaiKey) {
        services.push({
          provider: 'OpenAI',
          service: 'Embedding Service', 
          isActive: true,
          configuration: {
            model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
          },
          healthStatus: 'healthy',
          lastChecked: new Date().toISOString()
        })
      }
    } catch (error) {
      services.push({
        provider: 'Embedding Service',
        service: 'Configuration Error',
        isActive: false,
        configuration: { error: 'No valid embedding service configured' },
        healthStatus: 'error',
        lastChecked: new Date().toISOString()
      })
    }

    // Check OpenRouter service
    const openRouterKey = process.env.OPENROUTER_API_KEY
    if (openRouterKey) {
      services.push({
        provider: 'OpenRouter',
        service: 'Chat Completion Service',
        isActive: true,
        configuration: {
          models: ['anthropic/claude-3-sonnet', 'openai/gpt-4', 'meta-llama/llama-3-70b']
        },
        healthStatus: 'healthy',
        lastChecked: new Date().toISOString()
      })
    }

    // Check database services
    const databaseUrl = process.env.DATABASE_URL
    if (databaseUrl) {
      services.push({
        provider: 'PostgreSQL',
        service: 'Vector Database',
        isActive: true,
        configuration: {
          hasConnectionPool: process.env.USE_CONNECTION_POOL === 'true',
          maxConnections: process.env.CONNECTION_POOL_MAX_CONNECTIONS || '10'
        },
        healthStatus: 'healthy',
        lastChecked: new Date().toISOString()
      })
    }

    // Check Redis/Valkey services
    const redisUrl = process.env.VALKEY_URL || process.env.REDIS_URL
    const hasRedisHost = process.env.VALKEY_HOST || process.env.REDIS_HOST
    if (redisUrl || hasRedisHost) {
      services.push({
        provider: 'Redis/Valkey',
        service: 'Caching Service',
        isActive: true,
        configuration: {
          endpoint: redisUrl || `${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`
        },
        healthStatus: 'healthy',
        lastChecked: new Date().toISOString()
      })
    }

    return services
  }

  /**
   * Perform health checks on all active services
   */
  async checkAllServicesHealth(): Promise<ServiceHealthCheck[]> {
    const services = await this.getProductionServices()
    const healthChecks: ServiceHealthCheck[] = []

    for (const service of services) {
      if (!service.isActive) continue

      const startTime = Date.now()
      let status: 'healthy' | 'warning' | 'error' = 'healthy'
      let error: string | undefined

      try {
        // Perform specific health checks based on service type
        if (service.provider === 'Azure OpenAI' || service.provider === 'OpenAI') {
          await this.checkEmbeddingServiceHealth()
        } else if (service.provider === 'OpenRouter') {
          await this.checkOpenRouterHealth()
        } else if (service.provider === 'PostgreSQL') {
          await this.checkDatabaseHealth()
        } else if (service.provider === 'Redis/Valkey') {
          await this.checkRedisHealth()
        }
      } catch (e) {
        status = 'error'
        error = e instanceof Error ? e.message : 'Unknown error'
      }

      healthChecks.push({
        service: `${service.provider} - ${service.service}`,
        status,
        latency: Date.now() - startTime,
        error,
        timestamp: new Date().toISOString()
      })
    }

    return healthChecks
  }

  /**
   * Check embedding service health
   */
  private async checkEmbeddingServiceHealth(): Promise<void> {
    const factory = new EmbeddingServiceFactory(this.prisma)
    const { service, releaseConnection } = await EmbeddingServiceFactory.createEmbeddingServiceWithRobustConnection()
    
    try {
      // Try to generate a small embedding to verify service is working
      await service.generateEmbedding('health check')
    } finally {
      await releaseConnection()
    }
  }

  /**
   * Check OpenRouter service health
   */
  private async checkOpenRouterHealth(): Promise<void> {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OpenRouter API key not configured')
    
    const openRouter = new OpenRouter(apiKey)
    // Try a minimal completion request
    await openRouter.createChatCompletion({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 1
    })
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch (error) {
      throw new Error(`Database health check failed: ${error}`)
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<void> {
    // This would need to be implemented based on your Redis client
    // For now, just check if the URL is configured
    const redisUrl = process.env.VALKEY_URL || process.env.REDIS_URL
    const hasRedisHost = process.env.VALKEY_HOST || process.env.REDIS_HOST
    if (!redisUrl && !hasRedisHost) {
      throw new Error('Redis/Valkey endpoint not configured')
    }
  }

  /**
   * Get aggregated metrics for all services
   */
  async getAggregatedMetrics(): Promise<{
    totalServices: number
    healthyServices: number
    warningServices: number
    errorServices: number
    overallHealth: 'healthy' | 'warning' | 'error'
    services: ProductionServiceMetrics[]
  }> {
    const services = await this.getProductionServices()
    const healthChecks = await this.checkAllServicesHealth()

    // Update service health based on health checks
    for (const service of services) {
      const healthCheck = healthChecks.find(hc => 
        hc.service.includes(service.provider) && hc.service.includes(service.service)
      )
      if (healthCheck) {
        service.healthStatus = healthCheck.status
        service.metrics = {
          ...service.metrics,
          avgResponseTime: healthCheck.latency
        }
      }
    }

    const totalServices = services.length
    const healthyServices = services.filter(s => s.healthStatus === 'healthy').length
    const warningServices = services.filter(s => s.healthStatus === 'warning').length  
    const errorServices = services.filter(s => s.healthStatus === 'error').length

    let overallHealth: 'healthy' | 'warning' | 'error' = 'healthy'
    if (errorServices > 0) overallHealth = 'error'
    else if (warningServices > 0) overallHealth = 'warning'

    return {
      totalServices,
      healthyServices,
      warningServices,
      errorServices,
      overallHealth,
      services
    }
  }

  async disconnect() {
    await this.prisma.$disconnect()
  }
}
