/// <reference types="jest" />
import nock from 'nock';
import { DatadogMetricsService } from '../services/datadog-metrics';

const SITE = 'us1.datadoghq.com';
const API_BASE = `https://api.${SITE}`;

describe('DatadogMetricsService', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.DD_API_KEY = 'test_api_key';
    process.env.DATADOG_SITE = SITE;
    process.env.DD_ENV = 'development';
    process.env.DD_SERVICE = 'vibecode-ai-gateway';
    process.env.DD_VERSION = '0.0.0-test';
  });

  afterEach(() => {
    nock.cleanAll();
    process.env = OLD_ENV;
  });

  it('submits a gauge metric with standard tags', async () => {
    const svc = new DatadogMetricsService();
    const scope = nock(API_BASE)
      .post('/api/v1/series', (body: any) => {
        const series = body?.series?.[0];
        const tags = series?.tags || [];
        return (
          series?.metric === 'vibecode.ai_gateway.test_unit' &&
          series?.type === 'gauge' &&
          Array.isArray(series?.points) && series.points.length === 1 &&
          tags.includes('env:development') &&
          tags.includes('service:vibecode-ai-gateway') &&
          tags.includes('version:0.0.0-test') &&
          tags.includes('component:ai-gateway')
        );
      })
      .matchHeader('DD-API-KEY', 'test_api_key')
      .reply(202, { status: 'ok' });

    const ok = await svc.submitMetric(
      'vibecode.ai_gateway.test_unit',
      1,
      ['component:ai-gateway']
    );

    expect(ok).toBe(true);
    expect(scope.isDone()).toBe(true);
  });

  it('supports submitSelectionMetric with sanitized model tag', async () => {
    const svc = new DatadogMetricsService();

    const scope = nock(API_BASE)
      .post('/api/v1/series', (body: any) => {
        const series = body?.series?.[0];
        const tags = series?.tags || [];
        return (
          series?.metric === 'vibecode.ai_gateway.selection' &&
          series?.type === 'count' &&
          tags.includes('task:code') &&
          tags.includes('model:openai_gpt-4o') &&
          tags.includes('env:development')
        );
      })
      .reply(202, { status: 'ok' });

    const ok = await svc.submitSelectionMetric('code', 'openai/gpt-4o', 'user-1');
    expect(ok).toBe(true);
    expect(scope.isDone()).toBe(true);
  });

  it('returns false when API key is missing', async () => {
    delete process.env.DD_API_KEY;
    delete process.env.DATADOG_API_KEY;

    const svc = new DatadogMetricsService();
    const ok = await svc.submitMetric('vibecode.ai_gateway.fail', 1, []);
    expect(ok).toBe(false);
  });
});
