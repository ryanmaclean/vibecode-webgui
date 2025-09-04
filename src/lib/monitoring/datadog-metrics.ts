import { MetricData } from './metrics-types';
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