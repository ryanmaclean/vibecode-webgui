interface DatadogTags {
  env: string
  service: string
  version: string
  team: string
  component: string
  [key: string]: string
}

interface MetricOptions {
  tags?: Partial<DatadogTags>
  timestamp?: number
  value?: number
}

class DatadogMetricsService {
  private standardTags: DatadogTags
  private isEnabled: boolean

  constructor() {
    this.standardTags = {
      env: process.env.NODE_ENV || 'development',
      service: 'vibecode-webgui',
      version: process.env.APP_VERSION || '0.1.0',
      team: 'platform',
      component: 'api' // Default component, can be overridden
    }
    
    this.isEnabled = process.env.NODE_ENV === 'production' && !!(process.env.DD_API_KEY || process.env.DATADOG_API_KEY)
  }

  private formatMetricName(component: string, metricName: string): string {
    return `vibecode.${component}.${metricName}`
  }

  private mergeTags(additionalTags?: Partial<DatadogTags>): DatadogTags {
    const merged: Record<string, string | undefined> = {
      ...this.standardTags,
      ...(additionalTags || {})
    }
    const clean: DatadogTags = {
      env: merged.env || this.standardTags.env,
      service: merged.service || this.standardTags.service,
      version: merged.version || this.standardTags.version,
      team: merged.team || this.standardTags.team,
      component: merged.component || this.standardTags.component
    }
    for (const [k, v] of Object.entries(merged)) {
      if (typeof v === 'string') {
        clean[k] = v
      }
    }
    return clean
  }

  // API Response Time Metrics
  recordResponseTime(responseTime: number, endpoint: string, method: string, statusCode: number, options?: MetricOptions) {
    if (!this.isEnabled) return

    const tags = this.mergeTags({
      ...options?.tags,
      component: 'api',
      endpoint,
      method: method.toLowerCase(),
      status_code: statusCode.toString()
    })

    this.sendMetric('vibecode.api.response_time', responseTime, tags, options?.timestamp)
  }

  // Frontend Page Load Time
  recordPageLoadTime(loadTime: number, pageName: string, options?: MetricOptions) {
    if (!this.isEnabled) return

    const tags = this.mergeTags({
      ...options?.tags,
      component: 'frontend',
      page: pageName
    })

    this.sendMetric('vibecode.frontend.page_load_time', loadTime, tags, options?.timestamp)
  }

  // Database Query Duration
  recordDatabaseQuery(duration: number, operation: string, collection: string, options?: MetricOptions) {
    if (!this.isEnabled) return

    const tags = this.mergeTags({
      ...options?.tags,
      component: 'database',
      operation,
      collection
    })

    this.sendMetric('vibecode.backend.database_query_duration', duration, tags, options?.timestamp)
  }

  // Chat Message Processing Time
  recordChatProcessing(processingTime: number, model: string, messageLength: number, options?: MetricOptions) {
    if (!this.isEnabled) return

    const tags = this.mergeTags({
      ...options?.tags,
      component: 'chat',
      model: model.replace('/', '_'), // Replace slashes for Datadog compatibility
      message_size: this.categorizeMessageSize(messageLength)
    })

    this.sendMetric('vibecode.chat.message_processing_time', processingTime, tags, options?.timestamp)
  }

  // File Upload Processing Duration
  recordFileUpload(duration: number, fileSize: number, fileType: string, options?: MetricOptions) {
    if (!this.isEnabled) return

    const tags = this.mergeTags({
      ...options?.tags,
      component: 'upload',
      file_type: fileType,
      size_category: this.categorizeFileSize(fileSize)
    })

    this.sendMetric('vibecode.upload.file_processing_duration', duration, tags, options?.timestamp)
  }

  // RAG Context Building Time
  recordRAGContext(duration: number, sourcesCount: number, relevanceScore: number, options?: MetricOptions) {
    if (!this.isEnabled) return

    const tags = this.mergeTags({
      ...options?.tags,
      component: 'rag',
      sources_count: this.categorizeSourcesCount(sourcesCount),
      relevance_tier: this.categorizeRelevanceScore(relevanceScore)
    })

    this.sendMetric('vibecode.rag.context_build_time', duration, tags, options?.timestamp)
  }

  // Web Search Performance
  recordWebSearch(duration: number, resultsCount: number, searchEngine: string, options?: MetricOptions) {
    if (!this.isEnabled) return

    const tags = this.mergeTags({
      ...options?.tags,
      component: 'websearch',
      search_engine: searchEngine,
      results_tier: this.categorizeResultsCount(resultsCount)
    })

    this.sendMetric('vibecode.websearch.query_duration', duration, tags, options?.timestamp)
  }

  // Function Calling Metrics
  recordFunctionCall(duration: number, functionName: string, success: boolean, options?: MetricOptions) {
    if (!this.isEnabled) return

    const tags = this.mergeTags({
      ...options?.tags,
      component: 'functions',
      function_name: functionName,
      success: success.toString()
    })

    this.sendMetric('vibecode.functions.execution_time', duration, tags, options?.timestamp)
  }

  // Hugging Face Model Performance
  recordHuggingFaceModel(duration: number, model: string, inputLength: number, outputLength: number, options?: MetricOptions) {
    if (!this.isEnabled) return

    const tags = this.mergeTags({
      ...options?.tags,
      component: 'huggingface',
      model: model.replace('/', '_'),
      input_size: this.categorizeMessageSize(inputLength),
      output_size: this.categorizeMessageSize(outputLength)
    })

    this.sendMetric('vibecode.huggingface.inference_time', duration, tags, options?.timestamp)
  }

  // Error Tracking
  recordError(errorType: string, component: string, endpoint?: string, options?: MetricOptions) {
    if (!this.isEnabled) return

    const tags = this.mergeTags({
      ...options?.tags,
      component,
      error_type: errorType,
      ...(endpoint && { endpoint })
    })

    this.sendMetric(`vibecode.${component}.errors`, 1, tags, options?.timestamp)
  }

  // Business Metrics
  recordUserAction(action: string, userId: string, workspaceId: string, options?: MetricOptions) {
    if (!this.isEnabled) return

    const tags = this.mergeTags({
      ...options?.tags,
      component: 'user_actions',
      action,
      user_type: userId.startsWith('test') ? 'test' : 'production',
      workspace_type: workspaceId.includes('demo') ? 'demo' : 'user'
    })

    this.sendMetric('vibecode.user.actions', 1, tags, options?.timestamp)
  }

  // Helper methods for categorization
  private categorizeMessageSize(length: number): string {
    if (length < 100) return 'small'
    if (length < 1000) return 'medium'
    if (length < 5000) return 'large'
    return 'xlarge'
  }

  private categorizeFileSize(bytes: number): string {
    if (bytes < 1024) return 'small'      // < 1KB
    if (bytes < 1024 * 1024) return 'medium'  // < 1MB
    if (bytes < 10 * 1024 * 1024) return 'large'  // < 10MB
    return 'xlarge'
  }

  private categorizeSourcesCount(count: number): string {
    if (count < 3) return 'few'
    if (count < 8) return 'medium'
    return 'many'
  }

  private categorizeRelevanceScore(score: number): string {
    if (score < 0.3) return 'low'
    if (score < 0.7) return 'medium'
    return 'high'
  }

  private categorizeResultsCount(count: number): string {
    if (count < 3) return 'few'
    if (count < 8) return 'medium'
    return 'many'
  }

  // Core metric sending functionality
  private async sendMetric(metricName: string, value: number, tags: DatadogTags, timestamp?: number) {
    try {
      // In production, this would send to Datadog API
      // For now, we'll log the metrics for monitoring
      const metric = {
        metric: metricName,
        points: [[timestamp || Math.floor(Date.now() / 1000), value]],
        tags: Object.entries(tags).map(([key, value]) => `${key}:${value}`)
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Datadog Metric:', JSON.stringify(metric, null, 2))
      }

      // In production, send to Datadog (prefer DD_API_KEY with DATADOG_API_KEY fallback)
      const apiKey = process.env.DD_API_KEY || process.env.DATADOG_API_KEY
      if (apiKey && process.env.NODE_ENV === 'production') {
        const response = await fetch('https://api.datadoghq.com/api/v1/series', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': apiKey
          },
          body: JSON.stringify({
            series: [metric]
          })
        })

        if (!response.ok) {
          console.error('Failed to send metric to Datadog:', response.statusText)
        }
      }
    } catch (error) {
      console.error('Error sending metric to Datadog:', error)
    }
  }

  // Batch metric sending for efficiency
  async sendBatchMetrics(metrics: Array<{
    name: string
    value: number
    tags: Partial<DatadogTags>
    timestamp?: number
  }>) {
    if (!this.isEnabled) return

    const formattedMetrics = metrics.map(metric => ({
      metric: metric.name,
      points: [[metric.timestamp || Math.floor(Date.now() / 1000), metric.value]],
      tags: Object.entries(this.mergeTags(metric.tags)).map(([key, value]) => `${key}:${value}`)
    }))

    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Datadog Batch Metrics:', JSON.stringify(formattedMetrics, null, 2))
      return
    }

    const apiKey = process.env.DD_API_KEY || process.env.DATADOG_API_KEY
    if (apiKey && process.env.NODE_ENV === 'production') {
      try {
        const response = await fetch('https://api.datadoghq.com/api/v1/series', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': apiKey
          },
          body: JSON.stringify({
            series: formattedMetrics
          })
        })

        if (!response.ok) {
          console.error('Failed to send batch metrics to Datadog:', response.statusText)
        }
      } catch (error) {
        console.error('Error sending batch metrics to Datadog:', error)
      }
    }
  }
}

// Export singleton instance
export const datadogMetrics = new DatadogMetricsService()

// Export types for external use
export type { DatadogTags, MetricOptions }