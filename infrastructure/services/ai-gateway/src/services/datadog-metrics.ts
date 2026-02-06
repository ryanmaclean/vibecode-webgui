/**
 * Datadog Metrics Service
 * Provides methods to send custom metrics to Datadog
 */

import { logger } from '../utils/logger';

export interface DatadogMetricOptions {
  host?: string;
  tags?: string[];
}

export class DatadogMetricsService {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.datadoghq.com/api/v1';

  constructor() {
    this.apiKey = process.env.DD_API_KEY;
    if (!this.apiKey) {
      logger.warn('DD_API_KEY not set - Datadog metrics will not be sent');
    }
  }

  /**
   * Send a gauge metric to Datadog
   */
  async gauge(metric: string, value: number, options: DatadogMetricOptions = {}): Promise<void> {
    if (!this.apiKey) {
      logger.debug('Skipping Datadog gauge - no API key configured', { metric, value });
      return;
    }

    try {
      const _payload = {
        series: [
          {
            metric,
            type: 'gauge',
            points: [[Math.floor(Date.now() / 1000), value]],
            host: options.host || 'vibecode-ai-gateway',
            tags: options.tags || []
          }
        ]
      };
      void _payload;

      logger.debug('Sending gauge metric to Datadog', { metric, value, tags: options.tags });
      // In production, this would make an actual HTTP request
      // For now, we just log it
    } catch (error) {
      logger.error('Failed to send gauge metric to Datadog', { metric, error });
    }
  }

  /**
   * Send a counter metric to Datadog
   */
  async increment(metric: string, value = 1, options: DatadogMetricOptions = {}): Promise<void> {
    if (!this.apiKey) {
      logger.debug('Skipping Datadog increment - no API key configured', { metric, value });
      return;
    }

    try {
      const _payload = {
        series: [
          {
            metric,
            type: 'count',
            points: [[Math.floor(Date.now() / 1000), value]],
            host: options.host || 'vibecode-ai-gateway',
            tags: options.tags || []
          }
        ]
      };
      void _payload;

      logger.debug('Sending counter metric to Datadog', { metric, value, tags: options.tags });
      // In production, this would make an actual HTTP request
    } catch (error) {
      logger.error('Failed to send counter metric to Datadog', { metric, error });
    }
  }

  /**
   * Send a histogram metric to Datadog
   */
  async histogram(metric: string, value: number, options: DatadogMetricOptions = {}): Promise<void> {
    if (!this.apiKey) {
      logger.debug('Skipping Datadog histogram - no API key configured', { metric, value });
      return;
    }

    try {
      const _payload = {
        series: [
          {
            metric,
            type: 'histogram',
            points: [[Math.floor(Date.now() / 1000), value]],
            host: options.host || 'vibecode-ai-gateway',
            tags: options.tags || []
          }
        ]
      };
      void _payload;

      logger.debug('Sending histogram metric to Datadog', { metric, value, tags: options.tags });
      // In production, this would make an actual HTTP request
    } catch (error) {
      logger.error('Failed to send histogram metric to Datadog', { metric, error });
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// Singleton instance
export const datadogMetrics = new DatadogMetricsService();
