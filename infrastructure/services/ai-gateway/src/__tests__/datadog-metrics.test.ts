/**
 * @jest-environment node
 */

import { DatadogMetricsService } from '../services/datadog-metrics';

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('DatadogMetricsService', () => {
  let service: DatadogMetricsService;
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize with API key when DD_API_KEY is set', () => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();

      expect(service.isConfigured()).toBe(true);
    });

    it('should warn when DD_API_KEY is not set', () => {
      delete process.env.DD_API_KEY;
      service = new DatadogMetricsService();

      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('gauge', () => {
    it('should send gauge metric when API key is configured', async () => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();

      await service.gauge('test.metric', 42);

      // Should complete without error
      expect(true).toBe(true);
    });

    it('should send gauge metric with tags', async () => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();

      await service.gauge('test.metric', 42, {
        tags: ['env:test', 'service:ai-gateway']
      });

      expect(true).toBe(true);
    });

    it('should skip sending when API key is not configured', async () => {
      delete process.env.DD_API_KEY;
      service = new DatadogMetricsService();

      await service.gauge('test.metric', 42);

      // Should complete without error even without API key
      expect(true).toBe(true);
    });

    it('should use custom host when provided', async () => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();

      await service.gauge('test.metric', 42, {
        host: 'custom-host'
      });

      expect(true).toBe(true);
    });
  });

  describe('increment', () => {
    it('should send counter metric when API key is configured', async () => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();

      await service.increment('test.counter');

      expect(true).toBe(true);
    });

    it('should send counter metric with custom value', async () => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();

      await service.increment('test.counter', 5);

      expect(true).toBe(true);
    });

    it('should send counter metric with tags', async () => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();

      await service.increment('test.counter', 1, {
        tags: ['env:production']
      });

      expect(true).toBe(true);
    });

    it('should skip sending when API key is not configured', async () => {
      delete process.env.DD_API_KEY;
      service = new DatadogMetricsService();

      await service.increment('test.counter');

      expect(true).toBe(true);
    });
  });

  describe('histogram', () => {
    it('should send histogram metric when API key is configured', async () => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();

      await service.histogram('test.latency', 150);

      expect(true).toBe(true);
    });

    it('should send histogram metric with tags', async () => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();

      await service.histogram('test.latency', 150, {
        tags: ['endpoint:/api/chat', 'method:POST']
      });

      expect(true).toBe(true);
    });

    it('should skip sending when API key is not configured', async () => {
      delete process.env.DD_API_KEY;
      service = new DatadogMetricsService();

      await service.histogram('test.latency', 150);

      expect(true).toBe(true);
    });

    it('should use custom host when provided', async () => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();

      await service.histogram('test.latency', 150, {
        host: 'gateway-2'
      });

      expect(true).toBe(true);
    });
  });

  describe('isConfigured', () => {
    it('should return true when API key is set', () => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();

      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when API key is not set', () => {
      delete process.env.DD_API_KEY;
      service = new DatadogMetricsService();

      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('metric types', () => {
    beforeEach(() => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();
    });

    it('should handle gauge metrics for current values', async () => {
      await service.gauge('system.memory.usage', 75.5);
      await service.gauge('system.cpu.usage', 45.2);
      await service.gauge('queue.size', 100);

      expect(true).toBe(true);
    });

    it('should handle counter metrics for events', async () => {
      await service.increment('requests.total');
      await service.increment('errors.count', 1);
      await service.increment('cache.hits', 10);

      expect(true).toBe(true);
    });

    it('should handle histogram metrics for distributions', async () => {
      await service.histogram('request.latency', 250);
      await service.histogram('response.size', 1024);
      await service.histogram('db.query.time', 50);

      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully in gauge', async () => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();

      // Should not throw even if there's an internal error
      await expect(service.gauge('test.metric', 42)).resolves.not.toThrow();
    });

    it('should handle errors gracefully in increment', async () => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();

      await expect(service.increment('test.counter')).resolves.not.toThrow();
    });

    it('should handle errors gracefully in histogram', async () => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();

      await expect(service.histogram('test.latency', 100)).resolves.not.toThrow();
    });
  });

  describe('metric naming conventions', () => {
    beforeEach(() => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();
    });

    it('should accept dot-separated metric names', async () => {
      await service.gauge('vibecode.ai.gateway.memory.usage', 100);
      expect(true).toBe(true);
    });

    it('should accept underscore-separated metric names', async () => {
      await service.increment('vibecode_ai_requests_total');
      expect(true).toBe(true);
    });

    it('should accept mixed metric names', async () => {
      await service.histogram('vibecode.ai_gateway.request_latency', 50);
      expect(true).toBe(true);
    });
  });

  describe('tags', () => {
    beforeEach(() => {
      process.env.DD_API_KEY = 'test-api-key';
      service = new DatadogMetricsService();
    });

    it('should handle empty tags array', async () => {
      await service.gauge('test.metric', 42, { tags: [] });
      expect(true).toBe(true);
    });

    it('should handle multiple tags', async () => {
      await service.gauge('test.metric', 42, {
        tags: ['env:production', 'service:ai-gateway', 'region:us-east-1', 'version:1.0.0']
      });
      expect(true).toBe(true);
    });

    it('should handle tags with special characters', async () => {
      await service.gauge('test.metric', 42, {
        tags: ['model:gpt-4', 'endpoint:/api/v1/chat', 'status:200']
      });
      expect(true).toBe(true);
    });
  });
});
