import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load env from local service .env.local first, then fall back to repo root .env.local
const localEnv = path.resolve(__dirname, '../../.env.local');
const rootEnv = path.resolve(__dirname, '../../../../.env.local');
if (fs.existsSync(localEnv)) dotenv.config({ path: localEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

// Force standard tags per request: env:development
process.env.DD_ENV = 'development';

(async () => {
  // Dynamically import AFTER env is loaded so constructor sees DD_API_KEY
  const { DatadogMetricsService } = await import('../services/datadog-metrics');
  const svc = new DatadogMetricsService();
  const metricName = 'vibecode.ai_gateway.test';
  const tags = ['component:ai-gateway', 'kind:test', `ts:${Date.now()}`];

  try {
    const ok = await svc.submitMetric(metricName, 1, tags);
    if (ok) {
       
      console.log(`Datadog metric submitted: ${metricName} tags=${tags.join(',')}`);
      logger.info('Datadog test metric submitted', { metric: metricName, tags });
      process.exit(0);
    } else {
       
      console.error('Datadog test metric NOT submitted (check API key/site)');
      process.exit(2);
    }
  } catch (err) {
     
    console.error('Error submitting Datadog test metric', err);
    process.exit(1);
  }
})();
