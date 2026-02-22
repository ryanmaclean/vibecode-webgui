/**
 * Unit Tests for Tail-Based Sampler
 * Tests the TailBasedSampler class and its sampling logic
 */

import { jest } from '@jest/globals';

// Mock downstream processor
const createMockProcessor = () => ({
  onEnd: jest.fn(),
  forceFlush: jest.fn().mockResolvedValue(undefined),
  shutdown: jest.fn().mockResolvedValue(undefined)
});

// Mock span factory
const createMockSpan = (options: {
  traceId: string;
  spanId?: string;
  parentSpanId?: string | null;
  hasError?: boolean;
  httpStatusCode?: number;
  statusCode?: number;
}) => ({
  spanContext: () => ({
    traceId: options.traceId,
    spanId: options.spanId || 'span-' + Math.random().toString(36).substring(7)
  }),
  parentSpanId: options.parentSpanId !== undefined ? options.parentSpanId : null,
  status: options.hasError || options.statusCode !== undefined ? {
    code: options.statusCode ?? (options.hasError ? 2 : 0)
  } : undefined,
  attributes: options.httpStatusCode ? {
    'http.status_code': options.httpStatusCode
  } : {}
});

describe('TailBasedSampler', () => {
  let TailBasedSampler: any;
  let createTailBasedSampler: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Set environment to allow imports
    delete process.env.DOCKER_BUILD;
    delete process.env.SKIP_MONITORING;
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;

    // Clear environment variables for default config
    delete process.env.OTEL_SAMPLING_ERROR_RATE;
    delete process.env.OTEL_SAMPLING_DEFAULT_RATE;
    delete process.env.OTEL_SAMPLING_BUFFER_TIMEOUT;
    delete process.env.OTEL_SAMPLING_MAX_BUFFER_SIZE;

    // Import the module
    const module = require('@/lib/monitoring/tail-based-sampler');
    TailBasedSampler = module.TailBasedSampler;
    createTailBasedSampler = module.createTailBasedSampler;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);

      const config = sampler.getConfig();
      expect(config.errorSampleRate).toBe(1.0);
      expect(config.defaultSampleRate).toBe(0.1);
      expect(config.bufferTimeout).toBe(30000);
      expect(config.maxBufferSize).toBe(10000);
    });

    it('should accept custom configuration', () => {
      const processor = createMockProcessor();
      const customConfig = {
        errorSampleRate: 0.5,
        defaultSampleRate: 0.05,
        bufferTimeout: 15000,
        maxBufferSize: 5000
      };
      const sampler = new TailBasedSampler(processor, customConfig);

      const config = sampler.getConfig();
      expect(config.errorSampleRate).toBe(0.5);
      expect(config.defaultSampleRate).toBe(0.05);
      expect(config.bufferTimeout).toBe(15000);
      expect(config.maxBufferSize).toBe(5000);
    });

    it('should validate error sample rate bounds', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        errorSampleRate: 1.5
      });

      const config = sampler.getConfig();
      expect(config.errorSampleRate).toBe(1.0);
    });

    it('should validate error sample rate minimum', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        errorSampleRate: -0.5
      });

      const config = sampler.getConfig();
      expect(config.errorSampleRate).toBe(1.0);
    });

    it('should validate default sample rate bounds', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        defaultSampleRate: 1.5
      });

      const config = sampler.getConfig();
      expect(config.defaultSampleRate).toBe(0.1);
    });

    it('should validate default sample rate minimum', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        defaultSampleRate: -0.5
      });

      const config = sampler.getConfig();
      expect(config.defaultSampleRate).toBe(0.1);
    });

    it('should read configuration from environment variables', () => {
      process.env.OTEL_SAMPLING_ERROR_RATE = '0.8';
      process.env.OTEL_SAMPLING_DEFAULT_RATE = '0.2';
      process.env.OTEL_SAMPLING_BUFFER_TIMEOUT = '60000';
      process.env.OTEL_SAMPLING_MAX_BUFFER_SIZE = '20000';

      jest.resetModules();
      const module = require('@/lib/monitoring/tail-based-sampler');
      const sampler = new module.TailBasedSampler(createMockProcessor());

      const config = sampler.getConfig();
      expect(config.errorSampleRate).toBe(0.8);
      expect(config.defaultSampleRate).toBe(0.2);
      expect(config.bufferTimeout).toBe(60000);
      expect(config.maxBufferSize).toBe(20000);
    });
  });

  describe('onStart', () => {
    it('should not throw when called', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);
      const span = createMockSpan({ traceId: 'trace-1' });

      expect(() => sampler.onStart(span, {})).not.toThrow();
    });
  });

  describe('onEnd', () => {
    it('should buffer spans for a trace', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);
      const span = createMockSpan({ traceId: 'trace-1', parentSpanId: 'parent-1' });

      sampler.onEnd(span);

      const stats = sampler.getStats();
      expect(stats.totalSpans).toBe(1);
      expect(stats.bufferedTraces).toBe(1);
      expect(stats.bufferedSpans).toBe(1);
    });

    it('should handle null span gracefully', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);

      expect(() => sampler.onEnd(null)).not.toThrow();

      const stats = sampler.getStats();
      expect(stats.totalSpans).toBe(0);
    });

    it('should handle span without trace ID', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);
      const span = {
        spanContext: () => ({ traceId: null })
      };

      sampler.onEnd(span);

      const stats = sampler.getStats();
      expect(stats.bufferedTraces).toBe(0);
    });

    it('should detect error spans and mark trace', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        errorSampleRate: 1.0
      });

      const errorSpan = createMockSpan({
        traceId: 'trace-1',
        hasError: true
      });
      const rootSpan = createMockSpan({
        traceId: 'trace-1',
        parentSpanId: null
      });

      sampler.onEnd(errorSpan);
      sampler.onEnd(rootSpan);

      // Error traces should be sampled
      expect(processor.onEnd).toHaveBeenCalledTimes(2);
    });

    it('should detect HTTP error status codes', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        errorSampleRate: 1.0
      });

      const errorSpan = createMockSpan({
        traceId: 'trace-1',
        httpStatusCode: 500
      });
      const rootSpan = createMockSpan({
        traceId: 'trace-1',
        parentSpanId: null
      });

      sampler.onEnd(errorSpan);
      sampler.onEnd(rootSpan);

      // HTTP error traces should be sampled
      expect(processor.onEnd).toHaveBeenCalledTimes(2);
    });

    it('should detect HTTP 4xx status codes as errors', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        errorSampleRate: 1.0
      });

      const errorSpan = createMockSpan({
        traceId: 'trace-1',
        httpStatusCode: 404
      });
      const rootSpan = createMockSpan({
        traceId: 'trace-1',
        parentSpanId: null
      });

      sampler.onEnd(errorSpan);
      sampler.onEnd(rootSpan);

      expect(processor.onEnd).toHaveBeenCalledTimes(2);
    });

    it('should flush trace when root span ends', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);

      const childSpan = createMockSpan({
        traceId: 'trace-1',
        parentSpanId: 'parent-1'
      });
      const rootSpan = createMockSpan({
        traceId: 'trace-1',
        parentSpanId: null
      });

      sampler.onEnd(childSpan);
      expect(processor.onEnd).not.toHaveBeenCalled();

      sampler.onEnd(rootSpan);
      // Should make sampling decision when root span ends
      const stats = sampler.getStats();
      expect(stats.bufferedTraces).toBe(0);
    });

    it('should recognize span with empty parent ID as root', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);

      const rootSpan = createMockSpan({
        traceId: 'trace-1',
        parentSpanId: '0000000000000000'
      });

      sampler.onEnd(rootSpan);

      const stats = sampler.getStats();
      expect(stats.bufferedTraces).toBe(0);
    });

    it('should flush oldest trace when buffer is full', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        maxBufferSize: 2
      });

      // Add 3 spans to exceed buffer size
      const span1 = createMockSpan({ traceId: 'trace-1', parentSpanId: 'parent-1' });
      const span2 = createMockSpan({ traceId: 'trace-2', parentSpanId: 'parent-2' });
      const span3 = createMockSpan({ traceId: 'trace-3', parentSpanId: 'parent-3' });

      sampler.onEnd(span1);
      sampler.onEnd(span2);

      const statsBefore = sampler.getStats();
      expect(statsBefore.bufferedSpans).toBe(2);

      sampler.onEnd(span3);

      // Should have flushed oldest trace
      const statsAfter = sampler.getStats();
      expect(statsAfter.bufferedSpans).toBeLessThan(3);
    });

    it('should not buffer when shutting down', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);

      sampler.shutdown();

      const span = createMockSpan({ traceId: 'trace-1' });
      sampler.onEnd(span);

      const stats = sampler.getStats();
      expect(stats.bufferedTraces).toBe(0);
    });
  });

  describe('forceFlush', () => {
    it('should flush all buffered traces', async () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);

      const span1 = createMockSpan({ traceId: 'trace-1', parentSpanId: 'parent-1' });
      const span2 = createMockSpan({ traceId: 'trace-2', parentSpanId: 'parent-2' });

      sampler.onEnd(span1);
      sampler.onEnd(span2);

      expect(sampler.getStats().bufferedTraces).toBe(2);

      await sampler.forceFlush();

      expect(sampler.getStats().bufferedTraces).toBe(0);
      expect(processor.forceFlush).toHaveBeenCalledTimes(1);
    });

    it('should call downstream processor forceFlush', async () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);

      await sampler.forceFlush();

      expect(processor.forceFlush).toHaveBeenCalled();
    });

    it('should handle missing forceFlush on downstream processor', async () => {
      const processor = { onEnd: jest.fn() };
      const sampler = new TailBasedSampler(processor);

      await expect(sampler.forceFlush()).resolves.not.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should flush all traces and clear buffers', async () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);

      const span = createMockSpan({ traceId: 'trace-1', parentSpanId: 'parent-1' });
      sampler.onEnd(span);

      expect(sampler.getStats().bufferedTraces).toBe(1);

      await sampler.shutdown();

      expect(sampler.getStats().bufferedTraces).toBe(0);
      expect(processor.shutdown).toHaveBeenCalledTimes(1);
    });

    it('should call downstream processor shutdown', async () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);

      await sampler.shutdown();

      expect(processor.shutdown).toHaveBeenCalled();
    });

    it('should handle missing shutdown on downstream processor', async () => {
      const processor = { onEnd: jest.fn() };
      const sampler = new TailBasedSampler(processor);

      await expect(sampler.shutdown()).resolves.not.toThrow();
    });

    it('should prevent buffering after shutdown', async () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);

      await sampler.shutdown();

      const span = createMockSpan({ traceId: 'trace-1' });
      sampler.onEnd(span);

      expect(sampler.getStats().bufferedTraces).toBe(0);
    });

    it('should clear timeout handles', async () => {
      jest.useFakeTimers();

      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);

      const span = createMockSpan({ traceId: 'trace-1', parentSpanId: 'parent-1' });
      sampler.onEnd(span);

      await sampler.shutdown();

      // Fast-forward time to ensure timeout would have fired
      jest.advanceTimersByTime(60000);

      // Timeout should not have triggered flush
      expect(sampler.getStats().bufferedTraces).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);

      const stats = sampler.getStats();
      expect(stats.totalSpans).toBe(0);
      expect(stats.sampledSpans).toBe(0);
      expect(stats.sampleRate).toBe(0);
      expect(stats.bufferedTraces).toBe(0);
      expect(stats.bufferedSpans).toBe(0);
    });

    it('should track total and sampled spans', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        defaultSampleRate: 1.0
      });

      const rootSpan = createMockSpan({ traceId: 'trace-1', parentSpanId: null });
      sampler.onEnd(rootSpan);

      const stats = sampler.getStats();
      expect(stats.totalSpans).toBe(1);
      expect(stats.sampledSpans).toBeGreaterThan(0);
    });

    it('should calculate sample rate correctly', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        defaultSampleRate: 1.0
      });

      const rootSpan = createMockSpan({ traceId: 'trace-1', parentSpanId: null });
      sampler.onEnd(rootSpan);

      const stats = sampler.getStats();
      expect(stats.sampleRate).toBeGreaterThan(0);
      expect(stats.sampleRate).toBeLessThanOrEqual(1);
    });

    it('should count buffered traces and spans', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);

      const span1 = createMockSpan({ traceId: 'trace-1', parentSpanId: 'parent-1' });
      const span2 = createMockSpan({ traceId: 'trace-1', parentSpanId: 'parent-1' });
      const span3 = createMockSpan({ traceId: 'trace-2', parentSpanId: 'parent-2' });

      sampler.onEnd(span1);
      sampler.onEnd(span2);
      sampler.onEnd(span3);

      const stats = sampler.getStats();
      expect(stats.bufferedTraces).toBe(2);
      expect(stats.bufferedSpans).toBe(3);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor);

      const config1 = sampler.getConfig();
      const config2 = sampler.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe('Sampling behavior', () => {
    it('should always sample error traces at error rate', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        errorSampleRate: 1.0,
        defaultSampleRate: 0.0
      });

      const errorSpan = createMockSpan({ traceId: 'trace-1', hasError: true });
      const rootSpan = createMockSpan({ traceId: 'trace-1', parentSpanId: null });

      sampler.onEnd(errorSpan);
      sampler.onEnd(rootSpan);

      expect(processor.onEnd).toHaveBeenCalledTimes(2);
    });

    it('should never sample successful traces when rate is 0', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        defaultSampleRate: 0.0
      });

      const rootSpan = createMockSpan({ traceId: 'trace-1', parentSpanId: null });
      sampler.onEnd(rootSpan);

      expect(processor.onEnd).not.toHaveBeenCalled();
    });

    it('should always sample successful traces when rate is 1', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        defaultSampleRate: 1.0
      });

      const rootSpan = createMockSpan({ traceId: 'trace-1', parentSpanId: null });
      sampler.onEnd(rootSpan);

      expect(processor.onEnd).toHaveBeenCalledTimes(1);
    });

    it('should forward all spans in a sampled trace', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        defaultSampleRate: 1.0
      });

      const span1 = createMockSpan({ traceId: 'trace-1', parentSpanId: 'parent-1' });
      const span2 = createMockSpan({ traceId: 'trace-1', parentSpanId: 'parent-1' });
      const rootSpan = createMockSpan({ traceId: 'trace-1', parentSpanId: null });

      sampler.onEnd(span1);
      sampler.onEnd(span2);
      sampler.onEnd(rootSpan);

      expect(processor.onEnd).toHaveBeenCalledTimes(3);
      expect(processor.onEnd).toHaveBeenCalledWith(span1);
      expect(processor.onEnd).toHaveBeenCalledWith(span2);
      expect(processor.onEnd).toHaveBeenCalledWith(rootSpan);
    });
  });

  describe('Buffer timeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should flush trace after timeout', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        bufferTimeout: 5000
      });

      const span = createMockSpan({ traceId: 'trace-1', parentSpanId: 'parent-1' });
      sampler.onEnd(span);

      expect(sampler.getStats().bufferedTraces).toBe(1);

      jest.advanceTimersByTime(5000);

      expect(sampler.getStats().bufferedTraces).toBe(0);
    });

    it('should not trigger timeout after manual flush', () => {
      const processor = createMockProcessor();
      const sampler = new TailBasedSampler(processor, {
        bufferTimeout: 5000
      });

      const rootSpan = createMockSpan({ traceId: 'trace-1', parentSpanId: null });
      sampler.onEnd(rootSpan);

      expect(sampler.getStats().bufferedTraces).toBe(0);

      jest.advanceTimersByTime(5000);

      // Should not cause any errors
      expect(sampler.getStats().bufferedTraces).toBe(0);
    });
  });

  describe('createTailBasedSampler factory', () => {
    it('should create a sampler instance', () => {
      const processor = createMockProcessor();
      const sampler = createTailBasedSampler(processor);

      expect(sampler).toBeInstanceOf(TailBasedSampler);
    });

    it('should accept custom configuration', () => {
      const processor = createMockProcessor();
      const config = { errorSampleRate: 0.5 };
      const sampler = createTailBasedSampler(processor, config);

      expect(sampler.getConfig().errorSampleRate).toBe(0.5);
    });

    it('should return null when processor is not provided', () => {
      const sampler = createTailBasedSampler(null);

      expect(sampler).toBeNull();
    });

    it('should return null in Docker build mode', () => {
      process.env.DOCKER_BUILD = 'true';
      jest.resetModules();
      const module = require('@/lib/monitoring/tail-based-sampler');

      const sampler = module.createTailBasedSampler(createMockProcessor());

      expect(sampler).toBeNull();
    });
  });
});
