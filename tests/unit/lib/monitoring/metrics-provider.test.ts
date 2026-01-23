/**
 * Unit tests for the Metrics Provider system
 *
 * These tests demonstrate the improved testability achieved through
 * dependency injection and the IMetricsProvider interface.
 */

import {
  IMetricsProvider,
  NoOpMetricsProvider,
  ConsoleMetricsProvider,
  MockMetricsProvider,
  CompositeMetricsProvider,
  metricsRegistry,
  createNoOpProvider,
  createConsoleProvider,
  createMockProvider,
  createCompositeProvider,
} from '@/lib/monitoring/metrics-provider';

describe('Metrics Provider System', () => {
  describe('IMetricsProvider Interface Compliance', () => {
    const providers: Array<{ name: string; create: () => IMetricsProvider }> = [
      { name: 'NoOpMetricsProvider', create: () => createNoOpProvider() },
      { name: 'ConsoleMetricsProvider', create: () => createConsoleProvider({ enabled: false }) },
      { name: 'MockMetricsProvider', create: () => createMockProvider() },
    ];

    providers.forEach(({ name, create }) => {
      describe(name, () => {
        let provider: IMetricsProvider;

        beforeEach(() => {
          provider = create();
        });

        it('should have a name property', () => {
          expect(provider.name).toBeDefined();
          expect(typeof provider.name).toBe('string');
        });

        it('should have an enabled property', () => {
          expect(typeof provider.enabled).toBe('boolean');
        });

        it('should implement increment()', () => {
          expect(() => provider.increment('test.counter')).not.toThrow();
          expect(() => provider.increment('test.counter', 5)).not.toThrow();
          expect(() => provider.increment('test.counter', 1, { tags: { env: 'test' } })).not.toThrow();
        });

        it('should implement decrement()', () => {
          expect(() => provider.decrement('test.counter')).not.toThrow();
          expect(() => provider.decrement('test.counter', 5)).not.toThrow();
        });

        it('should implement gauge()', () => {
          expect(() => provider.gauge('test.gauge', 42)).not.toThrow();
          expect(() => provider.gauge('test.gauge', 42, { tags: { host: 'localhost' } })).not.toThrow();
        });

        it('should implement histogram()', () => {
          expect(() => provider.histogram('test.histogram', 100)).not.toThrow();
        });

        it('should implement timing()', () => {
          expect(() => provider.timing('test.timing', 150)).not.toThrow();
        });

        it('should implement distribution()', () => {
          expect(() => provider.distribution('test.distribution', 50)).not.toThrow();
        });

        it('should implement set()', () => {
          expect(() => provider.set('test.set', 'unique-value')).not.toThrow();
          expect(() => provider.set('test.set', 123)).not.toThrow();
        });

        it('should implement flush() as async', async () => {
          await expect(provider.flush()).resolves.toBeUndefined();
        });

        it('should implement shutdown() as async', async () => {
          await expect(provider.shutdown()).resolves.toBeUndefined();
        });
      });
    });
  });

  describe('NoOpMetricsProvider', () => {
    let provider: NoOpMetricsProvider;

    beforeEach(() => {
      provider = new NoOpMetricsProvider();
    });

    it('should have name "noop"', () => {
      expect(provider.name).toBe('noop');
    });

    it('should be disabled', () => {
      expect(provider.enabled).toBe(false);
    });

    it('should not perform any operations', () => {
      // All operations should be no-ops
      provider.increment('test');
      provider.gauge('test', 100);
      provider.histogram('test', 50);
      // If we got here without error, the test passes
    });
  });

  describe('ConsoleMetricsProvider', () => {
    let provider: ConsoleMetricsProvider;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
      provider = new ConsoleMetricsProvider({
        enabled: true,
        logLevel: 'debug',
        prefix: '[TestMetrics]',
        timestamps: false,
      });
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should have name "console"', () => {
      expect(provider.name).toBe('console');
    });

    it('should be enabled when configured', () => {
      expect(provider.enabled).toBe(true);
    });

    it('should log metrics to console', () => {
      provider.increment('api.requests', 1, { tags: { endpoint: '/users' } });
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('[TestMetrics]');
      expect(consoleSpy.mock.calls[0][0]).toContain('INCREMENT');
      expect(consoleSpy.mock.calls[0][0]).toContain('api.requests');
    });

    it('should buffer metrics', () => {
      provider.increment('test1');
      provider.gauge('test2', 42);
      provider.histogram('test3', 100);

      const buffer = provider.getBuffer();
      expect(buffer.length).toBe(3);
      expect(buffer[0].type).toBe('increment');
      expect(buffer[1].type).toBe('gauge');
      expect(buffer[2].type).toBe('histogram');
    });

    it('should clear buffer on flush', async () => {
      provider.increment('test');
      expect(provider.getBuffer().length).toBe(1);

      await provider.flush();
      expect(provider.getBuffer().length).toBe(0);
    });

    it('should not log when disabled', () => {
      const disabledProvider = new ConsoleMetricsProvider({ enabled: false });
      disabledProvider.increment('test');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('MockMetricsProvider', () => {
    let provider: MockMetricsProvider;

    beforeEach(() => {
      provider = new MockMetricsProvider();
    });

    it('should have name "mock"', () => {
      expect(provider.name).toBe('mock');
    });

    it('should be enabled', () => {
      expect(provider.enabled).toBe(true);
    });

    describe('Counter Operations', () => {
      it('should track increment calls', () => {
        provider.increment('api.requests');
        provider.increment('api.requests');
        provider.increment('api.requests', 3);

        expect(provider.getCounter('api.requests')).toBe(5);
        expect(provider.getCallCount('api.requests', 'increment')).toBe(3);
      });

      it('should track decrement calls', () => {
        provider.increment('queue.size', 10);
        provider.decrement('queue.size', 3);

        expect(provider.getCounter('queue.size')).toBe(7);
      });
    });

    describe('Gauge Operations', () => {
      it('should track gauge values', () => {
        provider.gauge('memory.usage', 512);
        provider.gauge('memory.usage', 768);

        expect(provider.getGauge('memory.usage')).toBe(768);
      });

      it('should return undefined for unset gauges', () => {
        expect(provider.getGauge('nonexistent')).toBeUndefined();
      });
    });

    describe('Histogram Operations', () => {
      it('should track histogram values', () => {
        provider.histogram('response.time', 100);
        provider.histogram('response.time', 150);
        provider.histogram('response.time', 200);

        const values = provider.getHistogramValues('response.time');
        expect(values).toEqual([100, 150, 200]);
      });

      it('should track timing as histogram', () => {
        provider.timing('db.query', 50);
        provider.timing('db.query', 75);

        const values = provider.getHistogramValues('db.query');
        expect(values).toEqual([50, 75]);
      });
    });

    describe('Call Recording', () => {
      it('should record all calls with timestamps', () => {
        const before = Date.now();
        provider.increment('test', 1, { tags: { env: 'test' } });
        const after = Date.now();

        const calls = provider.getCalls();
        expect(calls.length).toBe(1);
        expect(calls[0].method).toBe('increment');
        expect(calls[0].name).toBe('test');
        expect(calls[0].value).toBe(1);
        expect(calls[0].options).toEqual({ tags: { env: 'test' } });
        expect(calls[0].timestamp).toBeGreaterThanOrEqual(before);
        expect(calls[0].timestamp).toBeLessThanOrEqual(after);
      });

      it('should filter calls by method', () => {
        provider.increment('counter1');
        provider.gauge('gauge1', 100);
        provider.increment('counter2');

        const incrementCalls = provider.getCallsForMethod('increment');
        expect(incrementCalls.length).toBe(2);
      });

      it('should filter calls by metric name', () => {
        provider.increment('api.requests', 1, { tags: { endpoint: '/users' } });
        provider.increment('api.requests', 1, { tags: { endpoint: '/posts' } });
        provider.increment('db.queries');

        const apiCalls = provider.getCallsForMetric('api.requests');
        expect(apiCalls.length).toBe(2);
      });

      it('should check if metric was called', () => {
        provider.increment('test.metric');

        expect(provider.wasMetricCalled('test.metric')).toBe(true);
        expect(provider.wasMetricCalled('test.metric', 'increment')).toBe(true);
        expect(provider.wasMetricCalled('test.metric', 'gauge')).toBe(false);
        expect(provider.wasMetricCalled('nonexistent')).toBe(false);
      });
    });

    describe('Summary Generation', () => {
      it('should generate a comprehensive summary', () => {
        provider.increment('requests', 10);
        provider.gauge('memory', 512);
        provider.histogram('latency', 100);
        provider.histogram('latency', 200);
        provider.histogram('latency', 300);

        const summary = provider.getSummary();

        expect(summary.totalCalls).toBe(5);
        expect(summary.counters).toEqual({ requests: 10 });
        expect(summary.gauges).toEqual({ memory: 512 });
        expect(summary.histograms.latency).toEqual({
          count: 3,
          sum: 600,
          avg: 200,
          min: 100,
          max: 300,
        });
      });
    });

    describe('Reset Functionality', () => {
      it('should reset all recorded data', () => {
        provider.increment('test', 5);
        provider.gauge('test2', 100);
        provider.histogram('test3', 50);

        provider.reset();

        expect(provider.getCalls().length).toBe(0);
        expect(provider.getCounter('test')).toBe(0);
        expect(provider.getGauge('test2')).toBeUndefined();
        expect(provider.getHistogramValues('test3')).toEqual([]);
      });
    });
  });

  describe('CompositeMetricsProvider', () => {
    let mockProvider1: MockMetricsProvider;
    let mockProvider2: MockMetricsProvider;
    let compositeProvider: CompositeMetricsProvider;

    beforeEach(() => {
      mockProvider1 = new MockMetricsProvider();
      mockProvider2 = new MockMetricsProvider();
      compositeProvider = new CompositeMetricsProvider([mockProvider1, mockProvider2]);
    });

    it('should have name "composite"', () => {
      expect(compositeProvider.name).toBe('composite');
    });

    it('should be enabled when at least one provider is enabled', () => {
      expect(compositeProvider.enabled).toBe(true);
    });

    it('should send metrics to all providers', () => {
      compositeProvider.increment('test.metric', 1, { tags: { env: 'test' } });

      expect(mockProvider1.getCounter('test.metric')).toBe(1);
      expect(mockProvider2.getCounter('test.metric')).toBe(1);
    });

    it('should flush all providers', async () => {
      const flush1 = jest.spyOn(mockProvider1, 'flush');
      const flush2 = jest.spyOn(mockProvider2, 'flush');

      await compositeProvider.flush();

      expect(flush1).toHaveBeenCalled();
      expect(flush2).toHaveBeenCalled();
    });

    it('should shutdown all providers', async () => {
      const shutdown1 = jest.spyOn(mockProvider1, 'shutdown');
      const shutdown2 = jest.spyOn(mockProvider2, 'shutdown');

      await compositeProvider.shutdown();

      expect(shutdown1).toHaveBeenCalled();
      expect(shutdown2).toHaveBeenCalled();
    });

    it('should return provider names', () => {
      const names = compositeProvider.getProviderNames();
      expect(names).toContain('mock');
      expect(names.length).toBe(2);
    });

    it('should handle errors in individual providers gracefully', () => {
      const errorProvider = createMockProvider();
      jest.spyOn(errorProvider, 'increment').mockImplementation(() => {
        throw new Error('Provider error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const composite = new CompositeMetricsProvider([errorProvider, mockProvider1]);

      // Should not throw
      expect(() => composite.increment('test')).not.toThrow();

      // But should have logged the error
      expect(consoleSpy).toHaveBeenCalled();

      // Other provider should still receive the metric
      expect(mockProvider1.getCounter('test')).toBe(1);

      consoleSpy.mockRestore();
    });

    it('should exclude disabled providers', () => {
      const noopProvider = createNoOpProvider();
      const composite = new CompositeMetricsProvider([noopProvider, mockProvider1]);

      // NoOp provider is disabled, so only mock should be in the list
      expect(composite.getProviderNames()).toEqual(['mock']);
    });
  });

  describe('MetricsRegistry', () => {
    afterEach(() => {
      // Reset registry after each test
      metricsRegistry.resetForTesting();
    });

    it('should return a provider', () => {
      const provider = metricsRegistry.getProvider();
      expect(provider).toBeDefined();
      expect(provider.name).toBeDefined();
    });

    it('should allow setting a custom provider', () => {
      const mockProvider = createMockProvider();
      metricsRegistry.setProvider(mockProvider);

      metricsRegistry.increment('test.metric');

      expect(mockProvider.wasMetricCalled('test.metric')).toBe(true);
    });

    it('should provide convenience methods', () => {
      const mockProvider = metricsRegistry.resetForTesting();

      metricsRegistry.increment('counter', 5);
      metricsRegistry.gauge('gauge', 100);
      metricsRegistry.histogram('histogram', 50);
      metricsRegistry.timing('timing', 200);

      expect(mockProvider.getCounter('counter')).toBe(5);
      expect(mockProvider.getGauge('gauge')).toBe(100);
      expect(mockProvider.getHistogramValues('histogram')).toEqual([50]);
    });

    it('should reset to mock provider for testing', () => {
      const mockProvider = metricsRegistry.resetForTesting();
      expect(mockProvider).toBeInstanceOf(MockMetricsProvider);
      expect(metricsRegistry.getProvider()).toBe(mockProvider);
    });
  });

  describe('Factory Functions', () => {
    it('should create NoOpProvider', () => {
      const provider = createNoOpProvider();
      expect(provider).toBeInstanceOf(NoOpMetricsProvider);
    });

    it('should create ConsoleProvider with options', () => {
      const provider = createConsoleProvider({
        enabled: true,
        prefix: '[Custom]',
      });
      expect(provider).toBeInstanceOf(ConsoleMetricsProvider);
      expect(provider.enabled).toBe(true);
    });

    it('should create MockProvider', () => {
      const provider = createMockProvider();
      expect(provider).toBeInstanceOf(MockMetricsProvider);
    });

    it('should create CompositeProvider', () => {
      const mock1 = createMockProvider();
      const mock2 = createMockProvider();
      const composite = createCompositeProvider([mock1, mock2]);

      expect(composite).toBeInstanceOf(CompositeMetricsProvider);
      expect(composite.getProviderNames().length).toBe(2);
    });
  });

  describe('Integration with server-monitoring', () => {
    it('should work with MetricsCollector from server-monitoring', async () => {
      // Dynamically import to get fresh instance
      const { MetricsCollector, createMockProvider } = await import('@/lib/server-monitoring');

      const metricsCollector = new MetricsCollector();
      const mockProvider = createMockProvider();
      metricsCollector.setProvider(mockProvider);

      // Test that metrics flow through to the provider
      metricsCollector.increment('test.counter', { service: 'api' });
      metricsCollector.gauge('test.gauge', 100, { host: 'localhost' });
      metricsCollector.histogram('test.histogram', 250, { operation: 'query' });

      // Verify the mock provider received the metrics
      expect(mockProvider.wasMetricCalled('test.counter', 'increment')).toBe(true);
      expect(mockProvider.wasMetricCalled('test.gauge', 'gauge')).toBe(true);
      expect(mockProvider.wasMetricCalled('test.histogram', 'histogram')).toBe(true);

      // Clean up
      metricsCollector.resetProvider();
    });

    it('should work with ApplicationLogger dependency injection', async () => {
      const {
        MetricsCollector,
        ApplicationLogger,
        createMockProvider,
      } = await import('@/lib/server-monitoring');

      const mockProvider = createMockProvider();
      const metricsCollector = new MetricsCollector();
      metricsCollector.setProvider(mockProvider);

      const logger = new ApplicationLogger(metricsCollector);

      // Use logger methods
      logger.logAuth('user_login', { userId: 'user123', success: true });
      logger.logWorkspace('file_created', { workspaceId: 'ws123', duration: 50 });
      logger.logAI('completion', { model: 'gpt-4', tokensUsed: 100, responseTime: 500 });

      // Verify metrics were recorded
      expect(mockProvider.wasMetricCalled('auth.success')).toBe(true);
      expect(mockProvider.wasMetricCalled('workspace.events')).toBe(true);
      expect(mockProvider.wasMetricCalled('ai.interactions')).toBe(true);
      expect(mockProvider.wasMetricCalled('ai.response_time')).toBe(true);
      expect(mockProvider.wasMetricCalled('ai.tokens_used')).toBe(true);
    });
  });
});
