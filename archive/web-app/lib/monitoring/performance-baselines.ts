/**
 * Performance Baselines and Monitoring for VibeCode WebGUI
 * Establishes performance baselines and monitors deviations
 */

import { logger } from '@/lib/logger'
import { datadogMetrics } from './datadog-metrics'

export interface PerformanceBaseline {
  operation: string
  p50: number  // 50th percentile (median)
  p95: number  // 95th percentile
  p99: number  // 99th percentile
  mean: number
  count: number
  lastUpdated: Date
  stdDeviation: number
}

export interface PerformanceAlert {
  operation: string
  metric: 'p50' | 'p95' | 'p99' | 'mean'
  threshold: number
  severity: 'warning' | 'critical'
  message: string
}

class PerformanceMonitoringService {
  private baselines = new Map<string, PerformanceBaseline>()
  private recentMeasurements = new Map<string, number[]>()
  private maxMeasurements = 1000 // Keep last 1000 measurements per operation
  
  // Performance thresholds based on operation type
  private static readonly BASELINE_THRESHOLDS = {
    // API Response times (ms)
    'api.auth': { p95: 500, p99: 1000 },
    'api.chat': { p95: 2000, p99: 5000 },
    'api.ai': { p95: 10000, p99: 20000 },
    'api.upload': { p95: 3000, p99: 8000 },
    'api.search': { p95: 1000, p99: 2000 },
    'api.workspace': { p95: 800, p99: 1500 },
    
    // Database operations (ms)
    'db.select': { p95: 100, p99: 500 },
    'db.insert': { p95: 200, p99: 800 },
    'db.update': { p95: 150, p99: 600 },
    'db.delete': { p95: 100, p99: 400 },
    'db.query': { p95: 300, p99: 1000 },
    
    // Cache operations (ms)
    'cache.get': { p95: 10, p99: 50 },
    'cache.set': { p95: 20, p99: 100 },
    'cache.delete': { p95: 15, p99: 75 },
    
    // AI operations (ms)
    'ai.chat_completion': { p95: 15000, p99: 30000 },
    'ai.embedding': { p95: 2000, p99: 5000 },
    'ai.function_call': { p95: 5000, p99: 10000 },
    
    // Business logic (ms)
    'business.workspace_creation': { p95: 2000, p99: 5000 },
    'business.file_processing': { p95: 3000, p99: 8000 },
    'business.user_session': { p95: 500, p99: 1000 },
    
    // Frontend metrics (ms)
    'frontend.page_load': { p95: 3000, p99: 6000 },
    'frontend.component_render': { p95: 100, p99: 300 },
    'frontend.api_call': { p95: 2000, p99: 5000 }
  }

  /**
   * Record a performance measurement
   */
  recordMeasurement(operation: string, duration: number, tags: Record<string, string> = {}) {
    // Store measurement
    if (!this.recentMeasurements.has(operation)) {
      this.recentMeasurements.set(operation, [])
    }
    
    const measurements = this.recentMeasurements.get(operation)!
    measurements.push(duration)
    
    // Keep only recent measurements
    if (measurements.length > this.maxMeasurements) {
      measurements.shift()
    }
    
    // Update baseline if we have enough data
    if (measurements.length >= 50) { // Minimum 50 measurements for baseline
      this.updateBaseline(operation, measurements)
    }
    
    // Log the measurement
    logger.performance(operation, duration, {
      operation,
      tags: JSON.stringify(tags),
      baseline_exists: this.baselines.has(operation)
    })
    
    // Submit to Datadog
    datadogMetrics.recordResponseTime(
      duration,
      operation,
      'PERF',
      200,
      { tags }
    )
    
    // Check for performance degradation
    this.checkPerformanceAlerts(operation, duration)
  }

  /**
   * Update performance baseline for an operation
   */
  private updateBaseline(operation: string, measurements: number[]) {
    const sorted = [...measurements].sort((a, b) => a - b)
    const len = sorted.length
    
    const p50 = this.percentile(sorted, 50)
    const p95 = this.percentile(sorted, 95)
    const p99 = this.percentile(sorted, 99)
    const mean = sorted.reduce((a, b) => a + b, 0) / len
    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / len
    const stdDeviation = Math.sqrt(variance)
    
    const baseline: PerformanceBaseline = {
      operation,
      p50,
      p95,
      p99,
      mean,
      count: len,
      lastUpdated: new Date(),
      stdDeviation
    }
    
    this.baselines.set(operation, baseline)
    
    // Log baseline update
    console.log(`Performance baseline updated: ${operation}`, {
      operation,
      baseline: {
        p50: Math.round(p50),
        p95: Math.round(p95),
        p99: Math.round(p99),
        mean: Math.round(mean),
        count: len
      }
    })
    
    // Submit baseline metrics to Datadog
    this.submitBaselineMetrics(operation, baseline)
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], percentile: number): number {
    const index = (percentile / 100) * (sorted.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index - lower
    
    if (upper >= sorted.length) return sorted[sorted.length - 1]
    if (lower < 0) return sorted[0]
    
    return sorted[lower] * (1 - weight) + sorted[upper] * weight
  }

  /**
   * Submit baseline metrics to Datadog
   */
  private submitBaselineMetrics(operation: string, baseline: PerformanceBaseline) {
    const tags = { operation }
    
    datadogMetrics.sendBatchMetrics([
      {
        name: `vibecode.baseline.${operation}.p50`,
        value: baseline.p50,
        tags,
      },
      {
        name: `vibecode.baseline.${operation}.p95`,
        value: baseline.p95,
        tags,
      },
      {
        name: `vibecode.baseline.${operation}.p99`,
        value: baseline.p99,
        tags,
      },
      {
        name: `vibecode.baseline.${operation}.mean`,
        value: baseline.mean,
        tags,
      },
      {
        name: `vibecode.baseline.${operation}.stddev`,
        value: baseline.stdDeviation,
        tags,
      }
    ])
  }

  /**
   * Check for performance alerts based on baselines and thresholds
   */
  private checkPerformanceAlerts(operation: string, duration: number) {
    const baseline = this.baselines.get(operation)
    const thresholds = PerformanceMonitoringService.BASELINE_THRESHOLDS[operation as keyof typeof PerformanceMonitoringService.BASELINE_THRESHOLDS]
    
    const alerts: PerformanceAlert[] = []
    
    // Check against established baseline
    if (baseline) {
      // Alert if current measurement is significantly higher than baseline
      if (duration > baseline.p99 * 1.5) {
        alerts.push({
          operation,
          metric: 'p99',
          threshold: baseline.p99 * 1.5,
          severity: 'critical',
          message: `Performance severely degraded: ${duration}ms vs baseline P99 ${Math.round(baseline.p99)}ms`
        })
      } else if (duration > baseline.p95 * 2) {
        alerts.push({
          operation,
          metric: 'p95',
          threshold: baseline.p95 * 2,
          severity: 'warning',
          message: `Performance degraded: ${duration}ms vs baseline P95 ${Math.round(baseline.p95)}ms`
        })
      }
    }
    
    // Check against predefined thresholds
    if (thresholds) {
      if (duration > thresholds.p99) {
        alerts.push({
          operation,
          metric: 'p99',
          threshold: thresholds.p99,
          severity: 'critical',
          message: `Performance threshold exceeded: ${duration}ms > ${thresholds.p99}ms (P99 threshold)`
        })
      } else if (duration > thresholds.p95) {
        alerts.push({
          operation,
          metric: 'p95',
          threshold: thresholds.p95,
          severity: 'warning',
          message: `Performance threshold warning: ${duration}ms > ${thresholds.p95}ms (P95 threshold)`
        })
      }
    }
    
    // Send alerts
    alerts.forEach(alert => {
      if (alert.severity === 'critical') {
        console.error(`Performance Alert: ${alert.message}`, {
          operation: alert.operation,
          duration,
          threshold: alert.threshold,
          metric: alert.metric,
          severity: alert.severity
        })
        
        // Submit critical performance metric
        logger.counter('vibecode.performance.alerts.critical', 1, {
          operation: alert.operation,
          metric: alert.metric
        })
      } else {
        console.warn(`Performance Warning: ${alert.message}`, {
          operation: alert.operation,
          duration,
          threshold: alert.threshold,
          metric: alert.metric,
          severity: alert.severity
        })
        
        // Submit warning performance metric
        logger.counter('vibecode.performance.alerts.warning', 1, {
          operation: alert.operation,
          metric: alert.metric
        })
      }
    })
  }

  /**
   * Get current performance baseline for an operation
   */
  getBaseline(operation: string): PerformanceBaseline | null {
    return this.baselines.get(operation) || null
  }

  /**
   * Get all current baselines
   */
  getAllBaselines(): Record<string, PerformanceBaseline> {
    const result: Record<string, PerformanceBaseline> = {}
    for (const [operation, baseline] of this.baselines.entries()) {
      result[operation] = baseline
    }
    return result
  }

  /**
   * Generate performance health report
   */
  generateHealthReport(): {
    overall_health: 'healthy' | 'warning' | 'critical'
    total_operations: number
    operations_with_baselines: number
    recent_alerts: {
      warnings: number
      critical: number
    }
    top_slow_operations: Array<{
      operation: string
      p99: number
      threshold: number | null
    }>
    recommendations: string[]
  } {
    const allBaselines = this.getAllBaselines()
    const totalOperations = this.recentMeasurements.size
    const operationsWithBaselines = Object.keys(allBaselines).length
    
    // Find slow operations
    const slowOperations = Object.entries(allBaselines)
      .map(([operation, baseline]) => {
        const threshold = PerformanceMonitoringService.BASELINE_THRESHOLDS[operation as keyof typeof PerformanceMonitoringService.BASELINE_THRESHOLDS]?.p99
        return {
          operation,
          p99: baseline.p99,
          threshold
        }
      })
      .sort((a, b) => b.p99 - a.p99)
      .slice(0, 5)
    
    // Determine overall health
    let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy'
    let warnings = 0
    let critical = 0
    
    slowOperations.forEach(op => {
      if (op.threshold && op.p99 > op.threshold * 1.5) {
        critical++
        overallHealth = 'critical'
      } else if (op.threshold && op.p99 > op.threshold) {
        warnings++
        if (overallHealth !== 'critical') {
          overallHealth = 'warning'
        }
      }
    })
    
    // Generate recommendations
    const recommendations: string[] = []
    
    if (operationsWithBaselines < totalOperations * 0.8) {
      recommendations.push('Insufficient baseline data - need more measurements for accurate monitoring')
    }
    
    if (critical > 0) {
      recommendations.push(`${critical} operations showing critical performance issues - immediate attention required`)
    }
    
    if (warnings > 2) {
      recommendations.push('Multiple operations showing performance warnings - review and optimize')
    }
    
    const dbOperations = slowOperations.filter(op => op.operation.startsWith('db.'))
    if (dbOperations.length > 0 && dbOperations[0].p99 > 1000) {
      recommendations.push('Database operations are slow - consider query optimization and indexing')
    }
    
    const aiOperations = slowOperations.filter(op => op.operation.startsWith('ai.'))
    if (aiOperations.length > 0 && aiOperations[0].p99 > 20000) {
      recommendations.push('AI operations are slow - consider model optimization or parallel processing')
    }
    
    return {
      overall_health: overallHealth,
      total_operations: totalOperations,
      operations_with_baselines: operationsWithBaselines,
      recent_alerts: {
        warnings,
        critical
      },
      top_slow_operations: slowOperations,
      recommendations
    }
  }

  /**
   * Export baselines for persistence/restoration
   */
  exportBaselines(): string {
    const data = {
      timestamp: new Date().toISOString(),
      baselines: this.getAllBaselines()
    }
    return JSON.stringify(data, null, 2)
  }

  /**
   * Import baselines from saved data
   */
  importBaselines(data: string): void {
    try {
      const parsed = JSON.parse(data)
      if (parsed.baselines) {
        this.baselines.clear()
        for (const [operation, baseline] of Object.entries(parsed.baselines)) {
          this.baselines.set(operation, baseline as PerformanceBaseline)
        }
        console.log('Performance baselines imported successfully', {
          count: this.baselines.size,
          source_timestamp: parsed.timestamp
        })
      }
    } catch (error) {
      console.error('Failed to import performance baselines', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
}

// Export singleton instance
export const performanceBaselines = new PerformanceMonitoringService()

// Export types
export type { PerformanceBaseline, PerformanceAlert }