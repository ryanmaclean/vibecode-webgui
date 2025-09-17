import { datadogMetrics } from '../services/datadog-metrics';
import { logger } from '../utils/logger';

(async () => {
  const metricName = 'vibecode.ai_gateway.test';
  const tags = ['component:ai-gateway', 'kind:test', `ts:${Date.now()}`];

  try {
    const ok = await datadogMetrics.submitMetric(metricName, 1, tags);
    if (ok) {
      // eslint-disable-next-line no-console
      console.log(`Datadog metric submitted: ${metricName} tags=${tags.join(',')}`);
      logger.info('Datadog test metric submitted', { metric: metricName, tags });
      process.exit(0);
    } else {
      // eslint-disable-next-line no-console
      console.error('Datadog test metric NOT submitted (check API key/site)');
      process.exit(2);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error submitting Datadog test metric', err);
    process.exit(1);
  }
})();
