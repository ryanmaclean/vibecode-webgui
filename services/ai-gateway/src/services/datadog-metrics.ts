import axios from 'axios';
import { logger } from '../utils/logger';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import pkg from '../../package.json';

// Optional DogStatsD client via hot-shots
let HotShotsStatsD: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  HotShotsStatsD = require('hot-shots').StatsD;
} catch {
  HotShotsStatsD = undefined;
}

export class DatadogMetricsService {
  private apiKey: string | undefined;
  private site: string;
  private service: string;
  private env: string;
  private version: string;
  private debugHighCardinality: boolean;
  private debugSampleRate: number;
  private statsd?: any;

  constructor() {
    this.apiKey = process.env.DATADOG_API_KEY || process.env.DD_API_KEY;
    this.site = process.env.DATADOG_SITE || 'us1.datadoghq.com';
    this.service = process.env.DD_SERVICE || 'vibecode-ai-gateway';
    this.env = process.env.DD_ENV || 'development';
    this.version = process.env.DD_VERSION || (pkg as any).version || '1.0.0';
    this.debugHighCardinality = (process.env.DD_DEBUG_HIGH_CARDINALITY || 'false').toLowerCase() === 'true';
    this.debugSampleRate = Math.max(0, Math.min(1, parseFloat(process.env.DD_DEBUG_SAMPLE_RATE || '0.001')));

    // Initialize DogStatsD if enabled
    if ((process.env.DD_USE_DOGSTATSD || 'false').toLowerCase() === 'true' && HotShotsStatsD) {
      const host = process.env.DD_DOGSTATSD_HOST || '127.0.0.1';
      const port = parseInt(process.env.DD_DOGSTATSD_PORT || '8125', 10);
      try {
        this.statsd = new HotShotsStatsD({
          host,
          port,
          globalTags: [`env:${this.env}`, `service:${this.service}`, `version:${this.version}`],
          errorHandler: (e: any) => logger.warn('DogStatsD error', { error: e?.message || String(e) })
        });
        logger.info('DogStatsD client initialized', { host, port });
      } catch (e: any) {
        logger.warn('Failed to initialize DogStatsD client; using HTTP metrics transport', { error: e?.message || String(e) });
      }
    }
  }

  public async submitMetric(
    metric: string,
    value: number,
    tags: string[] = [],
    type: 'gauge' | 'count' | 'rate' = 'gauge'
  ): Promise<boolean> {
    // Prefer DogStatsD if available
    if (this.statsd) {
      try {
        if (metric.endsWith('latency_ms')) {
          this.statsd.histogram(metric, value, tags);
        } else if (type === 'count') {
          this.statsd.increment(metric, value, tags);
        } else {
          this.statsd.gauge(metric, value, tags);
        }
        return true;
      } catch (e: any) {
        logger.warn('DogStatsD submit failed; attempting HTTP fallback', { metric, error: e?.message || String(e) });
      }
    }

    if (!this.apiKey) {
      logger.warn('Datadog API key not set; skipping metric submission', { metric });
      return false;
    }

    const url = `https://api.${this.site}/api/v1/series`;
    const ts = Math.floor(Date.now() / 1000);
    const baseTags = [`env:${this.env}`, `service:${this.service}`, `version:${this.version}`];

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

  public async submitSelectionMetric(task: string, model: string, _userId?: string): Promise<boolean> {
    const { provider, family, full } = normalizeModel(model);
    const baseTags = [
      `task:${task}`,
      `model_provider:${provider}`,
      `model_family:${family}`
    ];

    // Optional full model tag gated behind flag + sampling
    const includeFullModel = this.debugHighCardinality && Math.random() < this.debugSampleRate;
    const tags = includeFullModel ? [...baseTags, `model:${full}`] : baseTags;

    return this.submitMetric('vibecode.ai_gateway.selection', 1, tags, 'count');
  }
}

export const datadogMetrics = new DatadogMetricsService();

function normalizeModel(input: string): { provider: string; family: string; full: string } {
  const sanitized = (input || 'unknown').replace(/[:/]/g, '_');
  const [providerRaw, modelRaw] = (input || 'unknown/unknown').split('/', 2);
  const provider = (providerRaw || 'unknown').toLowerCase();
  const modelId = modelRaw || providerRaw || 'unknown';
  const parts = modelId.split('-');
  const family = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : parts[0];
  return {
    provider,
    family: family.toLowerCase(),
    full: sanitized
  };
}
