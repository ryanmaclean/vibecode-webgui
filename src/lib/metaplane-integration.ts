/**
 * Metaplane Data Observability Integration
 * Datadog Acquisition (April 2025) - AI-Powered Data Quality Monitoring
 * 
 * Staff Engineer Implementation | July 2025
 */

import { datadogLogs } from '@datadog/browser-logs'

export interface DataPipelineConfig {
  name: string
  source: string
  destination: string
  schema: Record<string, any>
  qualityChecks: DataQualityCheck[]
  freshnessSLA: number // minutes
  volumeThresholds: {
    min: number
    max: number
  }
}

export interface DataQualityCheck {
  name: string
  type: 'schema_drift' | 'null_rate' | 'duplicate_rate' | 'freshness' | 'volume' | 'custom'
  column?: string
  threshold: number
  critical: boolean
  description: string
  query?: string
}

export interface DataObservabilityMetrics {
  pipeline: string
  timestamp: Date
  rowCount: number
  schemaVersion: string
  freshness: number // minutes since last update
  qualityScore: number // 0-100
  anomalies: DataAnomaly[]
  lineage: DataLineage[]
}

export interface DataAnomaly {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affectedRows: number
  suggestedAction: string
}

export interface DataLineage {
  upstream: string[]
  downstream: string[]
  transformations: string[]
  dependencies: string[]
}

/**
 * Metaplane-style Data Observability Engine
 * Provides AI-powered data quality monitoring with ML-based anomaly detection
 */
export class MetaplaneDataObservability {
  private pipelines: Map<string, DataPipelineConfig> = new Map()
  private metrics: Map<string, DataObservabilityMetrics[]> = new Map()
  private readonly aiModelEndpoint = process.env.METAPLANE_AI_ENDPOINT || 'https://api.metaplane.dev/v1'

  constructor(private config: {
    datadogApiKey: string
    environment: string
    enableAIDetection: boolean
  }) {}

  /**
   * Register a data pipeline for monitoring
   */
  registerPipeline(pipeline: DataPipelineConfig): void {
    this.pipelines.set(pipeline.name, pipeline)
    
    // Send pipeline registration to Datadog
    datadogLogs.logger.info('Data pipeline registered', {
      pipeline: pipeline.name,
      source: pipeline.source,
      destination: pipeline.destination,
      qualityChecks: pipeline.qualityChecks.length,
      service: 'metaplane-integration'
    })
  }

  /**
   * Monitor data quality for a specific pipeline
   */
  async monitorPipeline(pipelineName: string, data: any[]): Promise<DataObservabilityMetrics> {
    const pipeline = this.pipelines.get(pipelineName)
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineName} not registered`)
    }

    const metrics: DataObservabilityMetrics = {
      pipeline: pipelineName,
      timestamp: new Date(),
      rowCount: data.length,
      schemaVersion: this.calculateSchemaVersion(data),
      freshness: this.calculateFreshness(data),
      qualityScore: 0,
      anomalies: [],
      lineage: await this.getDataLineage(pipelineName)
    }

    // Run quality checks
    for (const check of pipeline.qualityChecks) {
      const result = await this.runQualityCheck(check, data)
      if (!result.passed) {
        metrics.anomalies.push({
          type: check.type,
          severity: check.critical ? 'critical' : 'medium',
          description: `${check.name}: ${result.message}`,
          affectedRows: result.affectedRows,
          suggestedAction: this.getSuggestedAction(check, result)
        })
      }
    }

    // AI-powered anomaly detection
    if (this.config.enableAIDetection) {
      const aiAnomalies = await this.detectAnomaliesWithAI(pipelineName, data, metrics)
      metrics.anomalies.push(...aiAnomalies)
    }

    // Calculate overall quality score
    metrics.qualityScore = this.calculateQualityScore(metrics.anomalies, pipeline.qualityChecks)

    // Store metrics
    if (!this.metrics.has(pipelineName)) {
      this.metrics.set(pipelineName, [])
    }
    this.metrics.get(pipelineName)!.push(metrics)

    // Send metrics to Datadog
    await this.sendMetricsToDatadog(metrics)

    return metrics
  }

  /**
   * AI-powered anomaly detection using Metaplane's ML models
   */
  private async detectAnomaliesWithAI(
    pipelineName: string,
    data: any[],
    metrics: DataObservabilityMetrics
  ): Promise<DataAnomaly[]> {
    try {
      const historicalMetrics = this.metrics.get(pipelineName) || []
      const response = await fetch(`${this.aiModelEndpoint}/anomaly-detection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.datadogApiKey}`
        },
        body: JSON.stringify({
          pipeline: pipelineName,
          current_metrics: metrics,
          historical_metrics: historicalMetrics.slice(-100), // Last 100 runs
          data_sample: data.slice(0, 1000) // First 1000 rows for analysis
        })
      })

      if (!response.ok) {
        throw new Error(`AI anomaly detection failed: ${response.statusText}`)
      }

      const result = await response.json()
      return result.anomalies.map((anomaly: any) => ({
        type: 'ai_detected',
        severity: anomaly.confidence > 0.8 ? 'high' : 'medium',
        description: anomaly.description,
        affectedRows: anomaly.affected_rows || 0,
        suggestedAction: anomaly.suggested_action || 'Review data pipeline configuration'
      }))
    } catch (error) {
      datadogLogs.logger.error('AI anomaly detection failed', {
        error: error.message,
        pipeline: pipelineName,
        service: 'metaplane-integration'
      })
      return []
    }
  }

  /**
   * Run individual data quality check
   */
  private async runQualityCheck(check: DataQualityCheck, data: any[]): Promise<{
    passed: boolean
    message: string
    affectedRows: number
    value: number
  }> {
    switch (check.type) {
      case 'null_rate':
        return this.checkNullRate(check, data)
      case 'duplicate_rate':
        return this.checkDuplicateRate(check, data)
      case 'schema_drift':
        return this.checkSchemaDrift(check, data)
      case 'volume':
        return this.checkVolume(check, data)
      case 'freshness':
        return this.checkFreshness(check, data)
      case 'custom':
        return this.runCustomCheck(check, data)
      default:
        return {
          passed: true,
          message: 'Unknown check type',
          affectedRows: 0,
          value: 0
        }
    }
  }

  private checkNullRate(check: DataQualityCheck, data: any[]): {
    passed: boolean
    message: string
    affectedRows: number
    value: number
  } {
    if (!check.column) {
      return { passed: false, message: 'Column not specified', affectedRows: 0, value: 0 }
    }

    const nullCount = data.filter(row => row[check.column] == null).length
    const nullRate = nullCount / data.length
    const passed = nullRate <= check.threshold

    return {
      passed,
      message: `Null rate ${(nullRate * 100).toFixed(2)}% ${passed ? 'within' : 'exceeds'} threshold ${(check.threshold * 100)}%`,
      affectedRows: nullCount,
      value: nullRate
    }
  }

  private checkDuplicateRate(check: DataQualityCheck, data: any[]): {
    passed: boolean
    message: string
    affectedRows: number
    value: number
  } {
    const uniqueValues = new Set()
    let duplicates = 0

    for (const row of data) {
      const key = check.column ? row[check.column] : JSON.stringify(row)
      if (uniqueValues.has(key)) {
        duplicates++
      } else {
        uniqueValues.add(key)
      }
    }

    const duplicateRate = duplicates / data.length
    const passed = duplicateRate <= check.threshold

    return {
      passed,
      message: `Duplicate rate ${(duplicateRate * 100).toFixed(2)}% ${passed ? 'within' : 'exceeds'} threshold ${(check.threshold * 100)}%`,
      affectedRows: duplicates,
      value: duplicateRate
    }
  }

  private checkSchemaDrift(check: DataQualityCheck, data: any[]): {
    passed: boolean
    message: string
    affectedRows: number
    value: number
  } {
    if (data.length === 0) {
      return { passed: true, message: 'No data to check', affectedRows: 0, value: 0 }
    }

    const currentSchema = Object.keys(data[0]).sort()
    const pipelineConfig = this.pipelines.get(check.name.split('_')[0])
    const expectedSchema = pipelineConfig ? Object.keys(pipelineConfig.schema).sort() : currentSchema

    const schemaDrift = currentSchema.length !== expectedSchema.length ||
      !currentSchema.every((col, index) => col === expectedSchema[index])

    return {
      passed: !schemaDrift,
      message: schemaDrift ? 'Schema drift detected' : 'Schema stable',
      affectedRows: schemaDrift ? data.length : 0,
      value: schemaDrift ? 1 : 0
    }
  }

  private checkVolume(check: DataQualityCheck, data: any[]): {
    passed: boolean
    message: string
    affectedRows: number
    value: number
  } {
    const volume = data.length
    const pipeline = this.pipelines.get(check.name.split('_')[0])
    const thresholds = pipeline?.volumeThresholds || { min: 0, max: Infinity }

    const passed = volume >= thresholds.min && volume <= thresholds.max

    return {
      passed,
      message: `Volume ${volume} ${passed ? 'within' : 'outside'} expected range [${thresholds.min}, ${thresholds.max}]`,
      affectedRows: passed ? 0 : Math.abs(volume - (volume < thresholds.min ? thresholds.min : thresholds.max)),
      value: volume
    }
  }

  private checkFreshness(check: DataQualityCheck, data: any[]): {
    passed: boolean
    message: string
    affectedRows: number
    value: number
  } {
    const freshness = this.calculateFreshness(data)
    const passed = freshness <= check.threshold

    return {
      passed,
      message: `Data freshness ${freshness.toFixed(1)}min ${passed ? 'within' : 'exceeds'} threshold ${check.threshold}min`,
      affectedRows: passed ? 0 : data.length,
      value: freshness
    }
  }

  private runCustomCheck(check: DataQualityCheck, data: any[]): {
    passed: boolean
    message: string
    affectedRows: number
    value: number
  } {
    // Custom SQL-like queries would be implemented here
    // For now, return a placeholder
    return {
      passed: true,
      message: 'Custom check not implemented',
      affectedRows: 0,
      value: 0
    }
  }

  private calculateFreshness(data: any[]): number {
    if (data.length === 0) return Infinity
    
    // Assume data has a timestamp field
    const timestampField = 'created_at' || 'updated_at' || 'timestamp'
    const timestamps = data
      .map(row => row[timestampField] ? new Date(row[timestampField]) : null)
      .filter(date => date !== null) as Date[]

    if (timestamps.length === 0) return Infinity

    const mostRecent = Math.max(...timestamps.map(d => d.getTime()))
    const now = Date.now()
    return (now - mostRecent) / (1000 * 60) // minutes
  }

  private calculateSchemaVersion(data: any[]): string {
    if (data.length === 0) return 'empty'
    
    const schema = Object.keys(data[0]).sort().join(',')
    return Buffer.from(schema).toString('base64').substring(0, 8)
  }

  private async getDataLineage(pipelineName: string): Promise<DataLineage[]> {
    // In a real implementation, this would query your data catalog
    return [{
      upstream: ['user_events', 'session_logs'],
      downstream: ['analytics_dashboard', 'ml_features'],
      transformations: ['aggregate', 'filter', 'join'],
      dependencies: ['postgres', 'redis']
    }]
  }

  private calculateQualityScore(anomalies: DataAnomaly[], checks: DataQualityCheck[]): number {
    if (checks.length === 0) return 100

    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical').length
    const highAnomalies = anomalies.filter(a => a.severity === 'high').length
    const mediumAnomalies = anomalies.filter(a => a.severity === 'medium').length

    const penalty = (criticalAnomalies * 30) + (highAnomalies * 20) + (mediumAnomalies * 10)
    return Math.max(0, 100 - penalty)
  }

  private getSuggestedAction(check: DataQualityCheck, result: any): string {
    switch (check.type) {
      case 'null_rate':
        return 'Review data ingestion pipeline for missing values'
      case 'duplicate_rate':
        return 'Implement deduplication logic or check for duplicate data sources'
      case 'schema_drift':
        return 'Update pipeline configuration to match new schema or revert schema changes'
      case 'volume':
        return 'Investigate data source for volume anomalies or adjust thresholds'
      case 'freshness':
        return 'Check data pipeline processing delays or increase update frequency'
      default:
        return 'Review data pipeline configuration and monitoring'
    }
  }

  private async sendMetricsToDatadog(metrics: DataObservabilityMetrics): Promise<void> {
    try {
      // Send custom metrics to Datadog
      const datadogMetrics = [
        {
          metric: 'data.pipeline.row_count',
          points: [[Date.now() / 1000, metrics.rowCount]],
          tags: [`pipeline:${metrics.pipeline}`, `service:vibecode-webgui`]
        },
        {
          metric: 'data.pipeline.quality_score',
          points: [[Date.now() / 1000, metrics.qualityScore]],
          tags: [`pipeline:${metrics.pipeline}`, `service:vibecode-webgui`]
        },
        {
          metric: 'data.pipeline.freshness',
          points: [[Date.now() / 1000, metrics.freshness]],
          tags: [`pipeline:${metrics.pipeline}`, `service:vibecode-webgui`]
        },
        {
          metric: 'data.pipeline.anomalies',
          points: [[Date.now() / 1000, metrics.anomalies.length]],
          tags: [`pipeline:${metrics.pipeline}`, `service:vibecode-webgui`]
        }
      ]

      const response = await fetch('https://api.datadoghq.com/api/v1/series', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.config.datadogApiKey
        },
        body: JSON.stringify({ series: datadogMetrics })
      })

      if (!response.ok) {
        throw new Error(`Failed to send metrics to Datadog: ${response.statusText}`)
      }

      // Log metrics for debugging
      datadogLogs.logger.info('Data observability metrics sent', {
        pipeline: metrics.pipeline,
        quality_score: metrics.qualityScore,
        anomalies: metrics.anomalies.length,
        freshness: metrics.freshness,
        service: 'metaplane-integration'
      })
    } catch (error) {
      datadogLogs.logger.error('Failed to send metrics to Datadog', {
        error: error.message,
        pipeline: metrics.pipeline,
        service: 'metaplane-integration'
      })
    }
  }

  /**
   * Get pipeline health summary
   */
  getPipelineHealth(pipelineName: string): {
    status: 'healthy' | 'degraded' | 'critical'
    lastCheck: Date | null
    qualityScore: number
    criticalAnomalies: number
  } {
    const pipelineMetrics = this.metrics.get(pipelineName) || []
    if (pipelineMetrics.length === 0) {
      return {
        status: 'critical',
        lastCheck: null,
        qualityScore: 0,
        criticalAnomalies: 0
      }
    }

    const latest = pipelineMetrics[pipelineMetrics.length - 1]
    const criticalAnomalies = latest.anomalies.filter(a => a.severity === 'critical').length

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy'
    if (criticalAnomalies > 0 || latest.qualityScore < 70) {
      status = 'critical'
    } else if (latest.qualityScore < 90 || latest.anomalies.length > 0) {
      status = 'degraded'
    }

    return {
      status,
      lastCheck: latest.timestamp,
      qualityScore: latest.qualityScore,
      criticalAnomalies
    }
  }
}

// Global instance for VibeCode WebGUI
export const metaplaneObservability = new MetaplaneDataObservability({
  datadogApiKey: process.env.DD_API_KEY || '',
  environment: process.env.DD_ENV || 'development',
  enableAIDetection: process.env.ENABLE_AI_DATA_DETECTION === 'true'
})

// Pre-configured pipelines for VibeCode WebGUI
export const initializeDataPipelines = () => {
  // User Analytics Pipeline
  metaplaneObservability.registerPipeline({
    name: 'user_analytics',
    source: 'user_events',
    destination: 'analytics_warehouse',
    schema: {
      user_id: 'string',
      event_type: 'string',
      timestamp: 'datetime',
      session_id: 'string',
      properties: 'json'
    },
    qualityChecks: [
      {
        name: 'user_id_null_rate',
        type: 'null_rate',
        column: 'user_id',
        threshold: 0.01,
        critical: true,
        description: 'User ID should not be null for more than 1% of events'
      },
      {
        name: 'event_freshness',
        type: 'freshness',
        threshold: 5,
        critical: true,
        description: 'Events should be processed within 5 minutes'
      },
      {
        name: 'duplicate_events',
        type: 'duplicate_rate',
        threshold: 0.05,
        critical: false,
        description: 'Duplicate events should be less than 5%'
      }
    ],
    freshnessSLA: 5,
    volumeThresholds: {
      min: 100,
      max: 100000
    }
  })

  // AI Training Data Pipeline
  metaplaneObservability.registerPipeline({
    name: 'ai_training_data',
    source: 'code_interactions',
    destination: 'ml_training_store',
    schema: {
      interaction_id: 'string',
      code_snippet: 'text',
      user_feedback: 'string',
      accepted: 'boolean',
      timestamp: 'datetime'
    },
    qualityChecks: [
      {
        name: 'code_snippet_null_rate',
        type: 'null_rate',
        column: 'code_snippet',
        threshold: 0.001,
        critical: true,
        description: 'Code snippets should not be missing'
      },
      {
        name: 'feedback_completeness',
        type: 'null_rate',
        column: 'user_feedback',
        threshold: 0.3,
        critical: false,
        description: 'User feedback should be available for 70% of interactions'
      }
    ],
    freshnessSLA: 15,
    volumeThresholds: {
      min: 50,
      max: 10000
    }
  })
}