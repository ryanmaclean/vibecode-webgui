/**
 * Performance Monitoring System for VibeCode Platform
 * Integrates with Datadog for comprehensive performance tracking
 */

import { monitoring } from '../monitoring'

interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'bytes' | 'count' | 'percent'
  tags?: string[]
  timestamp?: number
}

interface LoadTestResult {
  test_name: string
  duration_seconds: number
  total_requests: number
  requests_per_second: number
  error_rate: number
  p50_response_time: number
  p95_response_time: number
  p99_response_time: number
  passed: boolean
  thresholds_failed?: string[]
}

interface LighthouseResult {
  page: string
  performance_score: number
  first_contentful_paint: number
  largest_contentful_paint: number
  speed_index: number
  interactive: number
  total_blocking_time: number
  cumulative_layout_shift: number
  passed: boolean
}

interface SyntheticTestResult {
  test_name: string
  tests_run: number
  tests_passed: number
  tests_failed: number
  success_rate: number
  response_time_avg: number
  passed: boolean
  test_details?: Array<{
    status: 'passed' | 'failed'
    line: string
  }>
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetric[] = []
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * Track client-side performance metrics (Web Vitals)
   */
  trackWebVitals(metric: {
    name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB'
    value: number
    id: string
  }) {
    const performanceMetric: PerformanceMetric = {
      name: `web_vitals.${metric.name.toLowerCase()}`,
      value: metric.value,
      unit: 'ms',
      tags: [
        'source:web_vitals',
        `metric_id:${metric.id}`,
        'service:vibecode-webgui'
      ],
      timestamp: Date.now()
    }

    this.recordMetric(performanceMetric)
    
    // Submit to Datadog
    monitoring.submitMetric({
      metric: `vibecode.${performanceMetric.name}`,
      value: performanceMetric.value,
      tags: performanceMetric.tags
    })
  }

  /**
   * Track API response times
   */
  trackAPIPerformance(endpoint: string, method: string, responseTime: number, status: number) {
    const metric: PerformanceMetric = {
      name: 'api.response_time',
      value: responseTime,
      unit: 'ms',
      tags: [
        `endpoint:${endpoint}`,
        `method:${method}`,
        `status:${status}`,
        'service:vibecode-webgui'
      ]
    }

    this.recordMetric(metric)
    
    // Submit to Datadog
    monitoring.submitMetric({
      metric: 'vibecode.api.response_time',
      value: responseTime,
      tags: metric.tags
    })

    // Track error rates
    if (status >= 400) {
      monitoring.submitMetric({
        metric: 'vibecode.api.errors.count',
        value: 1,
        tags: metric.tags
      })
    }
  }

  /**
   * Track database query performance
   */
  trackDatabasePerformance(query: string, duration: number, rows?: number) {
    const metric: PerformanceMetric = {
      name: 'database.query_time',
      value: duration,
      unit: 'ms',
      tags: [
        `query_type:${this.categorizeQuery(query)}`,
        'service:vibecode-webgui'
      ]
    }

    if (rows !== undefined) {
      metric.tags?.push(`rows:${rows}`)
    }

    this.recordMetric(metric)
    
    // Submit to Datadog
    monitoring.submitMetric({
      metric: 'vibecode.database.query_time',
      value: duration,
      tags: metric.tags
    })

    if (rows !== undefined) {
      monitoring.submitMetric({
        metric: 'vibecode.database.rows_returned',
        value: rows,
        tags: metric.tags
      })
    }
  }

  /**
   * Generic operation tracker for analytics integration
   */
  trackOperation(name: string, value: number, success: boolean = true, metadata: Record<string, any> = {}) {
    const tags: string[] = ['service:vibecode-webgui', `success:${success}`]
    // Flatten metadata into tag strings key:value (primitives only)
    for (const [k, v] of Object.entries(metadata || {})) {
      if (v === undefined || v === null) continue
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
      tags.push(`${k}:${val}`)
    }

    const metric: PerformanceMetric = {
      name,
      value,
      unit: 'count',
      tags
    }

    this.recordMetric(metric)

    monitoring.submitMetric({
      metric: `vibecode.${name}`,
      value,
      tags
    })
  }

  /**
   * Process and submit K6 load test results
   */
  async submitLoadTestResults(results: LoadTestResult) {
    console.log(`📊 Processing load test results for: ${results.test_name}`)

    const baseTagsTest = [
      `test_name:${results.test_name}`,
      'test_type:load_test',
      'service:vibecode-webgui'
    ]
    
    // Submit core performance metrics
    const metrics = [
      { name: 'load_test.duration', value: results.duration_seconds, unit: 'seconds' },
      { name: 'load_test.total_requests', value: results.total_requests, unit: 'count' },
      { name: 'load_test.requests_per_second', value: results.requests_per_second, unit: 'count' },
      { name: 'load_test.error_rate', value: results.error_rate, unit: 'percent' },
      { name: 'load_test.p50_response_time', value: results.p50_response_time, unit: 'ms' },
      { name: 'load_test.p95_response_time', value: results.p95_response_time, unit: 'ms' },
      { name: 'load_test.p99_response_time', value: results.p99_response_time, unit: 'ms' },
    ]

    for (const metric of metrics) {
      await monitoring.submitMetric({
        metric: `vibecode.${metric.name}`,
        value: metric.value,
        tags: baseTagsTest
      })
    }

    // Submit test result event
    const alertType = results.passed ? 'success' : 'error'
    const eventText = results.passed 
      ? `Load test "${results.test_name}" passed all thresholds`
      : `Load test "${results.test_name}" failed. Failed thresholds: ${results.thresholds_failed?.join(', ')}`

    await monitoring.submitEvent(
      `Load Test: ${results.test_name}`,
      eventText,
      [...baseTagsTest, `result:${results.passed ? 'passed' : 'failed'}`, `alert_type:${alertType}`]
    )

    return results.passed
  }

  /**
   * Process and submit Datadog Synthetic test results
   */
  async submitSyntheticTestResults(results: SyntheticTestResult) {
    console.log(`🐕 Processing Datadog Synthetic test results for: ${results.test_name}`)

    const baseTagsTest = [
      `test_name:${results.test_name}`,
      'test_type:synthetic',
      'service:vibecode-webgui'
    ]
    
    // Submit core synthetic test metrics
    const metrics = [
      { name: 'synthetic_test.tests_run', value: results.tests_run, unit: 'count' },
      { name: 'synthetic_test.tests_passed', value: results.tests_passed, unit: 'count' },
      { name: 'synthetic_test.tests_failed', value: results.tests_failed, unit: 'count' },
      { name: 'synthetic_test.success_rate', value: results.success_rate, unit: 'percent' },
    ]

    // Add response time if available
    if (results.response_time_avg > 0) {
      metrics.push({ 
        name: 'synthetic_test.response_time_avg', 
        value: results.response_time_avg, 
        unit: 'ms' 
      })
    }

    for (const metric of metrics) {
      await monitoring.submitMetric({
        metric: `vibecode.${metric.name}`,
        value: metric.value,
        tags: baseTagsTest
      })
    }

    // Submit test result event
    const alertType = results.passed ? 'success' : 'error'
    const eventText = results.passed 
      ? `Synthetic test "${results.test_name}" passed (${results.tests_passed}/${results.tests_run} tests)`
      : `Synthetic test "${results.test_name}" failed (${results.tests_failed}/${results.tests_run} tests failed)`

    await monitoring.submitEvent(
      `Synthetic Test: ${results.test_name}`,
      eventText,
      [...baseTagsTest, `result:${results.passed ? 'passed' : 'failed'}`, `alert_type:${alertType}`]
    )

    return results.passed
  }

  /**
   * Process and submit Lighthouse performance results
   */
  async submitLighthouseResults(results: LighthouseResult) {
    console.log(`🔍 Processing Lighthouse results for: ${results.page}`)

    const baseTags = [
      `page:${results.page}`,
      'test_type:lighthouse',
      'service:vibecode-webgui'
    ]

    // Core Lighthouse metrics
    const metrics = [
      { name: 'lighthouse.performance_score', value: results.performance_score },
      { name: 'lighthouse.first_contentful_paint', value: results.first_contentful_paint },
      { name: 'lighthouse.largest_contentful_paint', value: results.largest_contentful_paint },
      { name: 'lighthouse.speed_index', value: results.speed_index },
      { name: 'lighthouse.interactive', value: results.interactive },
      { name: 'lighthouse.total_blocking_time', value: results.total_blocking_time },
      { name: 'lighthouse.cumulative_layout_shift', value: results.cumulative_layout_shift * 1000 }, // Convert to milliseconds for consistency
    ]

    for (const metric of metrics) {
      await monitoring.submitMetric({
        metric: `vibecode.${metric.name}`,
        value: metric.value,
        tags: baseTags
      })
    }

    // Submit Lighthouse audit event
    const alertType = results.passed ? 'success' : 'warning'
    const eventText = results.passed 
      ? `Lighthouse audit for "${results.page}" passed with score ${results.performance_score}/100`
      : `Lighthouse audit for "${results.page}" failed performance requirements (score: ${results.performance_score}/100)`

    await monitoring.submitEvent(
      `Lighthouse Audit: ${results.page}`,
      eventText,
      [...baseTags, `result:${results.passed ? 'passed' : 'failed'}`, `alert_type:${alertType}`]
    )

    return results.passed
  }

  /**
   * Track resource loading performance
   */
  trackResourceLoading(resource: {
    name: string
    type: 'script' | 'stylesheet' | 'image' | 'fetch' | 'other'
    size: number
    duration: number
  }) {
    const metric: PerformanceMetric = {
      name: 'resource.load_time',
      value: resource.duration,
      unit: 'ms',
      tags: [
        `resource_name:${resource.name}`,
        `resource_type:${resource.type}`,
        'service:vibecode-webgui'
      ]
    }

    this.recordMetric(metric)
    
    // Also track resource size
    monitoring.submitMetric({
      metric: 'vibecode.resource.size',
      value: resource.size,
      tags: metric.tags
    })

    monitoring.submitMetric({
      metric: 'vibecode.resource.load_time',
      value: resource.duration,
      tags: metric.tags
    })
  }

  /**
   * Monitor memory usage patterns
   */
  trackMemoryUsage(usage: {
    used: number
    total: number
    heap_used: number
    heap_total: number
  }) {
    const metrics = [
      { name: 'memory.used', value: usage.used },
      { name: 'memory.total', value: usage.total },
      { name: 'memory.heap_used', value: usage.heap_used },
      { name: 'memory.heap_total', value: usage.heap_total },
      { name: 'memory.usage_percent', value: (usage.used / usage.total) * 100 }
    ]

    const baseTags = ['service:vibecode-webgui', 'metric_type:memory']

    metrics.forEach(metric => {
      this.recordMetric({
        name: metric.name,
        value: metric.value,
        unit: metric.name.includes('percent') ? 'percent' : 'bytes',
        tags: baseTags
      })

      monitoring.submitMetric({
        metric: `vibecode.system.${metric.name}`,
        value: metric.value,
        tags: baseTags
      })
    })
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(timeframe = '1h'): {
    summary: any
    recommendations: string[]
    critical_issues: string[]
  } {
    const recentMetrics = this.getRecentMetrics(timeframe)
    
    const summary = {
      total_metrics: recentMetrics.length,
      avg_api_response_time: this.calculateAverage(recentMetrics, 'api.response_time'),
      avg_database_query_time: this.calculateAverage(recentMetrics, 'database.query_time'),
      memory_usage_trend: this.calculateTrend(recentMetrics, 'memory.usage_percent'),
      timeframe
    }

    const recommendations: string[] = []
    const critical_issues: string[] = []

    // Generate recommendations based on metrics
    if (summary.avg_api_response_time > 1000) {
      recommendations.push('API response times are high (>1s). Consider optimizing queries and adding caching.')
    }

    if (summary.avg_database_query_time > 500) {
      recommendations.push('Database query times are high (>500ms). Review slow queries and add indexes.')
    }

    if (summary.memory_usage_trend > 85) {
      critical_issues.push('Memory usage is consistently high (>85%). Monitor for memory leaks.')
    }

    return {
      summary,
      recommendations,
      critical_issues
    }
  }

  private recordMetric(metric: PerformanceMetric) {
    metric.timestamp = metric.timestamp || Date.now()
    this.metrics.push(metric)
    
    // Keep only last 1000 metrics to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  private categorizeQuery(query: string): string {
    const lowerQuery = query.toLowerCase().trim()
    
    if (lowerQuery.startsWith('select')) return 'select'
    if (lowerQuery.startsWith('insert')) return 'insert'
    if (lowerQuery.startsWith('update')) return 'update'
    if (lowerQuery.startsWith('delete')) return 'delete'
    if (lowerQuery.startsWith('create')) return 'create'
    if (lowerQuery.startsWith('alter')) return 'alter'
    
    return 'other'
  }

  private getRecentMetrics(timeframe: string) {
    const now = Date.now()
    const timeframeMs = this.parseTimeframe(timeframe)
    
    return this.metrics.filter(m => 
      m.timestamp && (now - m.timestamp) <= timeframeMs
    )
  }

  private parseTimeframe(timeframe: string): number {
    const match = timeframe.match(/(\d+)([hmd])/)
    if (!match) return 3600000 // Default 1 hour
    
    const value = parseInt(match[1])
    const unit = match[2]
    
    switch (unit) {
      case 'm': return value * 60 * 1000
      case 'h': return value * 60 * 60 * 1000
      case 'd': return value * 24 * 60 * 60 * 1000
      default: return 3600000
    }
  }

  private calculateAverage(metrics: PerformanceMetric[], name: string): number {
    const values = metrics
      .filter(m => m.name === name)
      .map(m => m.value)
    
    return values.length > 0 ? values.reduce((a, b) => a + b) / values.length : 0
  }

  private calculateTrend(metrics: PerformanceMetric[], name: string): number {
    const values = metrics
      .filter(m => m.name === name)
      .map(m => m.value)
      .slice(-10) // Last 10 values
    
    return values.length > 0 ? values.reduce((a, b) => a + b) / values.length : 0
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance()

// Browser-specific Web Vitals tracking (if running in browser)
if (typeof window !== 'undefined') {
  // Dynamically import web-vitals if available
  import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
    onCLS((metric) => performanceMonitor.trackWebVitals(metric))
    onFID((metric) => performanceMonitor.trackWebVitals(metric))
    onFCP((metric) => performanceMonitor.trackWebVitals(metric))
    onLCP((metric) => performanceMonitor.trackWebVitals(metric))
    onTTFB((metric) => performanceMonitor.trackWebVitals(metric))
  }).catch(() => {
    console.log('Web Vitals not available, skipping client-side performance tracking')
  })
}
