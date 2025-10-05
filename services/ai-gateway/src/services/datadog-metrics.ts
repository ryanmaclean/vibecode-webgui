import axios from 'axios';
import { logger } from '../utils/logger';
 
import pkg from '../../package.json';

export class DatadogMetricsService {
  private apiKey: string | undefined;
  private site: string;
  private service: string;
  private env: string;
  private version: string;

  constructor() {
    this.apiKey = process.env.DATADOG_API_KEY || process.env.DD_API_KEY;
    // Default to us1 site as requested
    this.site = process.env.DATADOG_SITE || 'us1.datadoghq.com';
    this.service = process.env.DD_SERVICE || 'vibecode-ai-gateway';
    // Force development by default if undefined
    this.env = process.env.DD_ENV || 'development';
    // Standard tag version from env or package.json
    this.version = process.env.DD_VERSION || (pkg as any).version || '1.0.0';
  }

  public async submitMetric(
    metric: string,
    value: number,
    tags: string[] = [],
    type: 'gauge' | 'count' | 'rate' = 'gauge'
  ): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn('Datadog API key not set; skipping metric submission', { metric });
      return false;
    }

    const url = `https://api.${this.site}/api/v1/series`;
    const ts = Math.floor(Date.now() / 1000);
    const baseTags = [
      `env:${this.env}`,
      `service:${this.service}`,
      `version:${this.version}`,
    ];

    const body = {
      series: [
        {
          metric,
          type,
          points: [[ts, value]],
          tags: [...baseTags, ...tags]
        }
      ]
    };

    try {
      const resp = await axios.post(url, body, {
        headers: {
          'DD-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      logger.info('Datadog metric submitted', { metric, status: resp.status });
      return resp.status >= 200 && resp.status < 300;
    } catch (error: any) {
      logger.warn('Failed to submit Datadog metric', {
        metric,
        error: error?.response?.status || error?.message
      });
      return false;
    }
  }

  public async submitSelectionMetric(task: string, model: string, userId?: string): Promise<boolean> {
    const tags = [
      `task:${task}`,
      `model:${model.replace(/[:/]/g, '_')}`,
      ...(userId ? [`user:${userId}`] : [])
    ];
    return this.submitMetric('vibecode.ai_gateway.selection', 1, tags, 'count');
  }
}

export const datadogMetrics = new DatadogMetricsService();
