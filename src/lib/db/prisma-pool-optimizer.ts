import { logger } from '@/lib/logger';


/**
 * Prisma Connection Pool Optimizer
 * Optimizes Prisma connection pool configuration for vector operations
 */

interface PoolConfig {
  minConnections: number
  maxConnections: number
  acquireTimeout: number
  idleTimeout: number
  transactionTimeout: number
}

interface PoolMetrics {
  activeConnections: number
  idleConnections: number
  totalConnections: number
  pendingRequests: number
  avgQueryTime: number
  connectionUtilization: number
}

export class PrismaPoolOptimizer {
  private metrics: PoolMetrics[] = []
  private currentConfig: PoolConfig
  
  constructor() {
    this.currentConfig = this.getDefaultConfig()
  }

  /**
   * Get default optimized configuration for vector operations
   */
  private getDefaultConfig(): PoolConfig {
    return {
      minConnections: Math.max(2, Math.floor(process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) * 0.1 : 2)),
      maxConnections: Math.min(20, parseInt(process.env.DB_CONNECTION_LIMIT || '10')),
      acquireTimeout: 30000, // 30 seconds for vector operations
      idleTimeout: 300000,   // 5 minutes
      transactionTimeout: 60000 // 1 minute for large vector inserts
    }
  }

  /**
   * Generate optimized Prisma connection string
   */
  generateOptimizedConnectionString(baseUrl: string): string {
    const url = new URL(baseUrl)
    
    // Add connection pool parameters
    url.searchParams.set('connection_limit', this.currentConfig.maxConnections.toString())
    url.searchParams.set('pool_timeout', Math.floor(this.currentConfig.acquireTimeout / 1000).toString())
    
    // Vector database specific optimizations
    url.searchParams.set('statement_timeout', '60000') // 60 seconds for vector operations
    url.searchParams.set('lock_timeout', '30000')      // 30 seconds for lock wait
    url.searchParams.set('idle_in_transaction_session_timeout', '300000') // 5 minutes
    
    // Performance optimizations
    url.searchParams.set('application_name', 'vibecode-vector-ops')
    url.searchParams.set('tcp_keepalives_idle', '600')
    url.searchParams.set('tcp_keepalives_interval', '30')
    url.searchParams.set('tcp_keepalives_count', '3')

    return url.toString()
  }

  /**
   * Collect connection pool metrics
   */
  async collectMetrics(): Promise<PoolMetrics> {
    // This would integrate with actual Prisma pool metrics
    // For now, simulate metrics collection
    const metrics: PoolMetrics = {
      activeConnections: Math.floor(Math.random() * this.currentConfig.maxConnections),
      idleConnections: Math.floor(Math.random() * 3),
      totalConnections: 0,
      pendingRequests: Math.floor(Math.random() * 5),
      avgQueryTime: 50 + Math.random() * 100,
      connectionUtilization: 0
    }
    
    metrics.totalConnections = metrics.activeConnections + metrics.idleConnections
    metrics.connectionUtilization = metrics.activeConnections / this.currentConfig.maxConnections
    
    this.metrics.push(metrics)
    
    // Keep only last 100 measurements
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100)
    }
    
    return metrics
  }

  /**
   * Analyze metrics and suggest optimizations
   */
  analyzeAndOptimize(): {
    recommendation: string
    suggestedConfig: Partial<PoolConfig>
    reasoning: string[]
  } {
    if (this.metrics.length < 10) {
      return {
        recommendation: 'insufficient_data',
        suggestedConfig: {},
        reasoning: ['Need more metrics data for optimization recommendations']
      }
    }

    const recentMetrics = this.metrics.slice(-20)
    const avgUtilization = recentMetrics.reduce((sum, m) => sum + m.connectionUtilization, 0) / recentMetrics.length
    const avgPending = recentMetrics.reduce((sum, m) => sum + m.pendingRequests, 0) / recentMetrics.length
    const avgQueryTime = recentMetrics.reduce((sum, m) => sum + m.avgQueryTime, 0) / recentMetrics.length

    const reasoning: string[] = []
    const suggestedConfig: Partial<PoolConfig> = {}

    // High utilization - increase pool size
    if (avgUtilization > 0.8) {
      suggestedConfig.maxConnections = Math.min(this.currentConfig.maxConnections + 5, 30)
      reasoning.push(`High connection utilization (${(avgUtilization * 100).toFixed(1)}%) - increase max connections`)
    }

    // High pending requests - increase pool size or reduce timeout
    if (avgPending > 2) {
      suggestedConfig.maxConnections = Math.min(this.currentConfig.maxConnections + 3, 25)
      reasoning.push(`High pending requests (${avgPending.toFixed(1)}) - increase connection capacity`)
    }

    // Low utilization - decrease pool size
    if (avgUtilization < 0.3 && this.currentConfig.maxConnections > 5) {
      suggestedConfig.maxConnections = Math.max(this.currentConfig.maxConnections - 2, 5)
      reasoning.push(`Low connection utilization (${(avgUtilization * 100).toFixed(1)}%) - reduce max connections`)
    }

    // Slow queries - increase timeout
    if (avgQueryTime > 200) {
      suggestedConfig.acquireTimeout = this.currentConfig.acquireTimeout + 10000
      reasoning.push(`Slow average query time (${avgQueryTime.toFixed(1)}ms) - increase acquire timeout`)
    }

    return {
      recommendation: reasoning.length > 0 ? 'optimize' : 'maintain',
      suggestedConfig,
      reasoning
    }
  }

  /**
   * Apply configuration changes
   */
  applyConfig(newConfig: Partial<PoolConfig>): void {
    this.currentConfig = { ...this.currentConfig, ...newConfig }
    logger.info('Applied new connection pool configuration:', newConfig)
  }

  /**
   * Get current configuration
   */
  getCurrentConfig(): PoolConfig {
    return { ...this.currentConfig }
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): {
    current: PoolMetrics | null
    average: Partial<PoolMetrics>
    recommendations: string[]
  } {
    const current = this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null
    
    if (this.metrics.length === 0) {
      return { current: null, average: {}, recommendations: ['No metrics available'] }
    }

    const average = {
      connectionUtilization: this.metrics.reduce((sum, m) => sum + m.connectionUtilization, 0) / this.metrics.length,
      avgQueryTime: this.metrics.reduce((sum, m) => sum + m.avgQueryTime, 0) / this.metrics.length,
      pendingRequests: this.metrics.reduce((sum, m) => sum + m.pendingRequests, 0) / this.metrics.length
    }

    const analysis = this.analyzeAndOptimize()
    
    return {
      current,
      average,
      recommendations: analysis.reasoning
    }
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = []
    this.currentConfig = this.getDefaultConfig()
  }
}

export const prismaPoolOptimizer = new PrismaPoolOptimizer()