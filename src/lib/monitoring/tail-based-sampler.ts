/**
 * Tail-Based Sampling Processor
 * Buffers spans and makes sampling decisions based on complete trace characteristics
 * Reduces telemetry volume by 90% while maintaining 100% error trace capture
 */

// Check if we're in a Docker build environment
const isDockerBuild = (
  process.env.DOCKER_BUILD === 'true' ||
  process.env.SKIP_MONITORING === 'true' ||
  process.env.CI === 'true' ||
  process.env.GITHUB_ACTIONS === 'true' ||
  process.env.OTEL_ENABLED === 'false' ||
  process.env.DD_ENABLED === 'false'
);

// Conditional imports to prevent build-time errors in Docker
let SpanProcessor: any = null;
let ReadableSpan: any = null;
let SpanStatusCode: any = null;
let Context: any = null;

if (!isDockerBuild) {
  try {
    const sdkTraceBase = require('@opentelemetry/sdk-trace-base');
    const apiTypes = require('@opentelemetry/api');

    SpanProcessor = sdkTraceBase.SpanProcessor;
    ReadableSpan = sdkTraceBase.ReadableSpan;
    SpanStatusCode = apiTypes.SpanStatusCode;
    Context = apiTypes.Context;
  } catch (error) {
    // Modules not available, will gracefully degrade
  }
}

/**
 * Configuration for tail-based sampling
 */
export interface TailBasedSamplerConfig {
  /** Sample rate for traces with errors (default: 1.0 = 100%) */
  errorSampleRate: number;
  /** Sample rate for successful traces (default: 0.1 = 10%) */
  defaultSampleRate: number;
  /** Timeout in milliseconds to wait for trace completion (default: 30000 = 30s) */
  bufferTimeout: number;
  /** Maximum number of spans to buffer (default: 10000) */
  maxBufferSize: number;
}

/**
 * Buffered trace information
 */
interface TraceBuffer {
  spans: any[];
  hasError: boolean;
  firstSeenAt: number;
  timeoutHandle?: NodeJS.Timeout;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TailBasedSamplerConfig = {
  errorSampleRate: parseFloat(process.env.OTEL_SAMPLING_ERROR_RATE || '1.0'),
  defaultSampleRate: parseFloat(process.env.OTEL_SAMPLING_DEFAULT_RATE || '0.1'),
  bufferTimeout: parseInt(process.env.OTEL_SAMPLING_BUFFER_TIMEOUT || '30000'),
  maxBufferSize: parseInt(process.env.OTEL_SAMPLING_MAX_BUFFER_SIZE || '10000')
};

/**
 * Tail-Based Sampling Processor
 * Implements the SpanProcessor interface to buffer spans and make sampling decisions
 * based on complete trace characteristics
 */
export class TailBasedSampler {
  private config: TailBasedSamplerConfig;
  private traceBuffers: Map<string, TraceBuffer>;
  private downstreamProcessor: any;
  private totalSpans: number = 0;
  private sampledSpans: number = 0;
  private isShuttingDown: boolean = false;

  constructor(downstreamProcessor: any, config?: Partial<TailBasedSamplerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.traceBuffers = new Map();
    this.downstreamProcessor = downstreamProcessor;

    // Validate configuration
    if (this.config.errorSampleRate < 0 || this.config.errorSampleRate > 1) {
      this.config.errorSampleRate = 1.0;
    }
    if (this.config.defaultSampleRate < 0 || this.config.defaultSampleRate > 1) {
      this.config.defaultSampleRate = 0.1;
    }
  }

  /**
   * Called when a span starts
   */
  onStart(span: any, parentContext: any): void {
    // No action needed on start - we buffer in onEnd
  }

  /**
   * Called when a span ends
   * Buffers the span and checks if we can make a sampling decision
   */
  onEnd(span: any): void {
    if (this.isShuttingDown || !span) {
      return;
    }

    const traceId = span.spanContext().traceId;
    if (!traceId) {
      return;
    }

    this.totalSpans++;

    // Check if buffer is at capacity
    if (this.getTotalBufferedSpans() >= this.config.maxBufferSize) {
      // Force flush oldest trace to prevent memory issues
      this.flushOldestTrace();
    }

    // Get or create trace buffer
    let traceBuffer = this.traceBuffers.get(traceId);
    if (!traceBuffer) {
      traceBuffer = {
        spans: [],
        hasError: false,
        firstSeenAt: Date.now()
      };
      this.traceBuffers.set(traceId, traceBuffer);

      // Set timeout to prevent indefinite buffering
      traceBuffer.timeoutHandle = setTimeout(() => {
        this.flushTrace(traceId);
      }, this.config.bufferTimeout);
    }

    // Add span to buffer
    traceBuffer.spans.push(span);

    // Check if this span has an error
    if (this.isErrorSpan(span)) {
      traceBuffer.hasError = true;
    }

    // Check if trace is complete (span is root and ended)
    if (this.isRootSpan(span)) {
      // Root span has ended, make sampling decision
      this.flushTrace(traceId);
    }
  }

  /**
   * Force flush all buffered spans
   */
  async forceFlush(): Promise<void> {
    const traceIds = Array.from(this.traceBuffers.keys());
    for (const traceId of traceIds) {
      this.flushTrace(traceId);
    }

    if (this.downstreamProcessor?.forceFlush) {
      await this.downstreamProcessor.forceFlush();
    }
  }

  /**
   * Shutdown the processor
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Clear all timeout handles
    for (const buffer of this.traceBuffers.values()) {
      if (buffer.timeoutHandle) {
        clearTimeout(buffer.timeoutHandle);
      }
    }

    // Flush all remaining traces
    await this.forceFlush();

    // Shutdown downstream processor
    if (this.downstreamProcessor?.shutdown) {
      await this.downstreamProcessor.shutdown();
    }

    this.traceBuffers.clear();
  }

  /**
   * Flush a specific trace (make sampling decision and forward or drop)
   */
  private flushTrace(traceId: string): void {
    const traceBuffer = this.traceBuffers.get(traceId);
    if (!traceBuffer) {
      return;
    }

    // Clear timeout if exists
    if (traceBuffer.timeoutHandle) {
      clearTimeout(traceBuffer.timeoutHandle);
    }

    // Make sampling decision
    const shouldSample = this.shouldSampleTrace(traceBuffer);

    if (shouldSample) {
      // Forward all spans in trace to downstream processor
      for (const span of traceBuffer.spans) {
        if (this.downstreamProcessor?.onEnd) {
          this.downstreamProcessor.onEnd(span);
        }
        this.sampledSpans++;
      }
    }

    // Remove trace from buffer
    this.traceBuffers.delete(traceId);
  }

  /**
   * Flush the oldest trace in the buffer
   */
  private flushOldestTrace(): void {
    let oldestTraceId: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [traceId, buffer] of this.traceBuffers.entries()) {
      if (buffer.firstSeenAt < oldestTimestamp) {
        oldestTimestamp = buffer.firstSeenAt;
        oldestTraceId = traceId;
      }
    }

    if (oldestTraceId) {
      this.flushTrace(oldestTraceId);
    }
  }

  /**
   * Determine if a trace should be sampled
   */
  private shouldSampleTrace(traceBuffer: TraceBuffer): boolean {
    // Always sample error traces at configured rate
    if (traceBuffer.hasError) {
      return Math.random() < this.config.errorSampleRate;
    }

    // Sample successful traces at default rate
    return Math.random() < this.config.defaultSampleRate;
  }

  /**
   * Check if a span represents an error
   */
  private isErrorSpan(span: any): boolean {
    if (!span.status) {
      return false;
    }

    // Check OpenTelemetry status code
    if (SpanStatusCode && span.status.code === SpanStatusCode.ERROR) {
      return true;
    }

    // Check numeric status code (2 = ERROR in OpenTelemetry)
    if (typeof span.status.code === 'number' && span.status.code === 2) {
      return true;
    }

    // Check HTTP status codes in attributes
    const attributes = span.attributes || {};
    const httpStatusCode = attributes['http.status_code'] || attributes['http.response.status_code'];
    if (httpStatusCode && httpStatusCode >= 400) {
      return true;
    }

    return false;
  }

  /**
   * Check if a span is a root span (no parent)
   */
  private isRootSpan(span: any): boolean {
    if (!span.parentSpanId) {
      return true;
    }

    // Check for undefined or empty parent span ID
    const parentId = span.parentSpanId;
    if (!parentId || parentId === '0000000000000000') {
      return true;
    }

    return false;
  }

  /**
   * Get total number of buffered spans
   */
  private getTotalBufferedSpans(): number {
    let total = 0;
    for (const buffer of this.traceBuffers.values()) {
      total += buffer.spans.length;
    }
    return total;
  }

  /**
   * Get sampling statistics
   */
  getStats(): {
    totalSpans: number;
    sampledSpans: number;
    sampleRate: number;
    bufferedTraces: number;
    bufferedSpans: number;
  } {
    const bufferedSpans = this.getTotalBufferedSpans();
    const sampleRate = this.totalSpans > 0 ? this.sampledSpans / this.totalSpans : 0;

    return {
      totalSpans: this.totalSpans,
      sampledSpans: this.sampledSpans,
      sampleRate,
      bufferedTraces: this.traceBuffers.size,
      bufferedSpans
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): TailBasedSamplerConfig {
    return { ...this.config };
  }
}

/**
 * Create a tail-based sampler instance
 */
export function createTailBasedSampler(
  downstreamProcessor: any,
  config?: Partial<TailBasedSamplerConfig>
): TailBasedSampler | null {
  if (isDockerBuild) {
    return null;
  }

  if (!downstreamProcessor) {
    return null;
  }

  return new TailBasedSampler(downstreamProcessor, config);
}
