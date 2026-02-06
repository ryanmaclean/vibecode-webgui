/**
 * MLX Datadog Tracing Integration
 *
 * Provides comprehensive observability for MLX operations including:
 * - Model loading and inference tracing
 * - Token generation metrics
 * - Embedding generation metrics
 * - Memory usage tracking
 * - LLM Observability integration
 *
 * Designed to work with:
 * - Datadog APM for distributed tracing
 * - Datadog LLM Observability for AI metrics
 * - workspace-rag system for RAG operations
 */

import { logger } from '@/lib/logger';
import { Span } from 'dd-trace';
import {
  MLXProvider,
  MLXInferenceOptions,
  MLXEmbeddingOptions,
  MLXModelConfig,
  MLXGenerationResult,
  MLXModelInfo,
  MLXStreamToken,
  MLXInferenceMetrics,
  mlxProvider,
} from './mlx-provider';

// Import ddtrace - must use CommonJS require for proper instrumentation
const tracer = require('../../instrument').default;

// MARK: - Types

export interface MLXTraceMetadata {
  /** Custom tags for the span */
  tags?: Record<string, string | number | boolean>;
  /** Input data (truncated for large inputs) */
  input?: string;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Session ID for multi-turn tracking */
  sessionId?: string;
  /** User ID for attribution */
  userId?: string;
}

export interface MLXSpanTags {
  // Standard MLX tags
  'mlx.model.name': string;
  'mlx.model.type'?: string;
  'mlx.model.quantization'?: string;
  'mlx.operation': string;
  'mlx.device'?: string;

  // Inference metrics
  'mlx.tokens.input'?: number;
  'mlx.tokens.output'?: number;
  'mlx.tokens.total'?: number;
  'mlx.tokens_per_second'?: number;
  'mlx.latency.first_token_ms'?: number;
  'mlx.latency.total_ms'?: number;

  // Embedding metrics
  'mlx.embedding.dimensions'?: number;
  'mlx.embedding.batch_size'?: number;
  'mlx.embedding.normalized'?: boolean;

  // Memory metrics
  'mlx.memory.peak_bytes'?: number;
  'mlx.memory.model_bytes'?: number;

  // Status
  'mlx.status': 'success' | 'error';
  'mlx.finish_reason'?: string;
  'error.message'?: string;
  'error.type'?: string;
}

// MARK: - MLX Tracing Configuration

export interface MLXTracingConfig {
  /** Enable tracing */
  enabled: boolean;
  /** Service name for spans */
  serviceName: string;
  /** ML application name for LLM Observability */
  mlApp: string;
  /** Enable detailed input/output logging */
  logInputOutput: boolean;
  /** Maximum input length to log (truncate longer) */
  maxInputLength: number;
  /** Maximum output length to log */
  maxOutputLength: number;
  /** Sample rate (0.0 - 1.0) */
  sampleRate: number;
}

const defaultConfig: MLXTracingConfig = {
  enabled: Boolean(process.env.DD_API_KEY || process.env.DATADOG_API_KEY),
  serviceName: process.env.DD_SERVICE || 'vibecode-mlx',
  mlApp: process.env.DD_LLMOBS_ML_APP || 'vibecode-ai',
  logInputOutput: process.env.DD_MLX_LOG_IO !== 'false',
  maxInputLength: 1000,
  maxOutputLength: 2000,
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
};

// MARK: - MLX Traced Provider

/**
 * Wrapper around MLXProvider that adds Datadog tracing to all operations
 */
export class MLXTracedProvider {
  private provider: MLXProvider;
  private config: MLXTracingConfig;

  constructor(provider: MLXProvider = mlxProvider, config: Partial<MLXTracingConfig> = {}) {
    this.provider = provider;
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Initialize with tracing
   */
  async initialize(): Promise<boolean> {
    return this.trace(
      'mlx.initialize',
      async () => {
        return this.provider.initialize();
      },
      {
        tags: {
          'mlx.operation': 'initialize',
          'mlx.model.name': 'system',
        },
      }
    );
  }

  /**
   * Check availability with tracing
   */
  async isAvailable(): Promise<boolean> {
    // Don't trace availability check - too noisy
    return this.provider.isAvailable();
  }

  /**
   * Load model with tracing
   */
  async loadModel(config: MLXModelConfig, metadata?: MLXTraceMetadata): Promise<MLXModelInfo> {
    return this.trace(
      'mlx.model.load',
      async (span) => {
        const info = await this.provider.loadModel(config);

        if (span) {
          span.setTag('mlx.model.parameters', info.parameterCount);
          span.setTag('mlx.model.context_length', info.contextLength);
          span.setTag('mlx.memory.model_bytes', info.memoryUsage);
        }

        return info;
      },
      {
        tags: {
          'mlx.operation': 'model_load',
          'mlx.model.name': config.name,
          'mlx.model.quantization': config.quantization || 'int4',
          'mlx.model.max_context': config.maxContextLength || 4096,
          ...(metadata?.tags || {}),
        },
        context: metadata?.context,
      }
    );
  }

  /**
   * Unload model with tracing
   */
  async unloadModel(name: string): Promise<void> {
    return this.trace(
      'mlx.model.unload',
      async () => {
        await this.provider.unloadModel(name);
      },
      {
        tags: {
          'mlx.operation': 'model_unload',
          'mlx.model.name': name,
        },
      }
    );
  }

  /**
   * Generate text with comprehensive tracing
   */
  async generateText(
    prompt: string,
    options: MLXInferenceOptions = {},
    metadata?: MLXTraceMetadata
  ): Promise<MLXGenerationResult> {
    const startTime = Date.now();

    return this.trace(
      'mlx.inference.text',
      async (span) => {
        const result = await this.provider.generateText(prompt, options);
        const duration = Date.now() - startTime;

        if (span) {
          // Set inference metrics
          span.setTag('mlx.tokens.input', result.metrics.promptTokens);
          span.setTag('mlx.tokens.output', result.metrics.totalTokens);
          span.setTag('mlx.tokens.total', result.metrics.promptTokens + result.metrics.totalTokens);
          span.setTag('mlx.tokens_per_second', result.metrics.tokensPerSecond);
          span.setTag('mlx.latency.first_token_ms', result.metrics.firstTokenLatency);
          span.setTag('mlx.latency.total_ms', duration);
          span.setTag('mlx.memory.peak_bytes', result.metrics.peakMemoryUsage);
          span.setTag('mlx.device', result.metrics.computeDevice);
          span.setTag('mlx.finish_reason', result.finishReason);

          // Log input/output if enabled
          if (this.config.logInputOutput) {
            span.setTag('mlx.input.text', this.truncate(prompt, this.config.maxInputLength));
            span.setTag('mlx.output.text', this.truncate(result.text, this.config.maxOutputLength));
          }
        }

        return result;
      },
      {
        tags: {
          'mlx.operation': 'text_generation',
          'mlx.model.name': 'default',
          'mlx.inference.max_tokens': options.maxTokens || 512,
          'mlx.inference.temperature': options.temperature || 0.7,
          'mlx.inference.top_p': options.topP || 0.9,
          ...(metadata?.tags || {}),
        },
        context: {
          sessionId: metadata?.sessionId,
          userId: metadata?.userId,
          ...metadata?.context,
        },
      }
    );
  }

  /**
   * Generate text with streaming and token-level tracing
   */
  async *generateTextStream(
    prompt: string,
    options: MLXInferenceOptions = {},
    metadata?: MLXTraceMetadata
  ): AsyncGenerator<MLXStreamToken, MLXInferenceMetrics, undefined> {
    const startTime = Date.now();
    let tokenCount = 0;
    let firstTokenTime: number | null = null;

    const span = this.startSpan('mlx.inference.stream', {
      'mlx.operation': 'text_generation_stream',
      'mlx.model.name': 'default',
      'mlx.inference.max_tokens': options.maxTokens || 512,
      'mlx.inference.temperature': options.temperature || 0.7,
      ...(metadata?.tags || {}),
    });

    try {
      const generator = this.provider.generateTextStream(prompt, options);

      for await (const token of generator) {
        tokenCount++;

        if (firstTokenTime === null) {
          firstTokenTime = Date.now() - startTime;
          if (span) {
            span.setTag('mlx.latency.first_token_ms', firstTokenTime);
          }
        }

        yield token;
      }

      // Get final metrics from generator return value
      const metrics = await generator.return(undefined as never);
      const duration = Date.now() - startTime;

      if (span && metrics.value) {
        span.setTag('mlx.tokens.output', tokenCount);
        span.setTag('mlx.tokens_per_second', metrics.value.tokensPerSecond);
        span.setTag('mlx.latency.total_ms', duration);
        span.setTag('mlx.memory.peak_bytes', metrics.value.peakMemoryUsage);
        span.setTag('mlx.device', metrics.value.computeDevice);
        span.setTag('mlx.status', 'success');
      }

      return metrics.value;
    } catch (error) {
      if (span) {
        span.setTag('mlx.status', 'error');
        span.setTag('error.message', error instanceof Error ? error.message : String(error));
        span.setTag('error.type', error instanceof Error ? error.constructor.name : 'UnknownError');
      }
      throw error;
    } finally {
      if (span) {
        span.finish();
      }
    }
  }

  /**
   * Generate embedding with tracing
   */
  async generateEmbedding(
    text: string,
    options: MLXEmbeddingOptions = {},
    metadata?: MLXTraceMetadata
  ): Promise<number[]> {
    const startTime = Date.now();

    return this.trace(
      'mlx.embedding.generate',
      async (span) => {
        const embedding = await this.provider.generateEmbedding(text, options);
        const duration = Date.now() - startTime;

        if (span) {
          span.setTag('mlx.embedding.dimensions', embedding.length);
          span.setTag('mlx.latency.total_ms', duration);
          span.setTag('mlx.embedding.normalized', options.normalize ?? true);

          if (this.config.logInputOutput) {
            span.setTag('mlx.input.text', this.truncate(text, this.config.maxInputLength));
          }
        }

        return embedding;
      },
      {
        tags: {
          'mlx.operation': 'embedding_generation',
          'mlx.model.name': options.model || 'default',
          'mlx.embedding.batch_size': 1,
          ...(metadata?.tags || {}),
        },
        context: metadata?.context,
      }
    );
  }

  /**
   * Generate batch embeddings with tracing
   */
  async generateEmbeddingsBatch(
    texts: string[],
    options: MLXEmbeddingOptions = {},
    metadata?: MLXTraceMetadata
  ): Promise<number[][]> {
    const startTime = Date.now();

    return this.trace(
      'mlx.embedding.batch',
      async (span) => {
        const embeddings = await this.provider.generateEmbeddingsBatch(texts, options);
        const duration = Date.now() - startTime;

        if (span) {
          span.setTag('mlx.embedding.batch_size', texts.length);
          span.setTag('mlx.embedding.dimensions', embeddings[0]?.length || 0);
          span.setTag('mlx.latency.total_ms', duration);
          span.setTag('mlx.latency.per_item_ms', duration / texts.length);
          span.setTag('mlx.embedding.normalized', options.normalize ?? true);
        }

        return embeddings;
      },
      {
        tags: {
          'mlx.operation': 'embedding_batch',
          'mlx.model.name': options.model || 'default',
          'mlx.embedding.batch_size': texts.length,
          ...(metadata?.tags || {}),
        },
        context: metadata?.context,
      }
    );
  }

  /**
   * RAG embedding with tracing
   */
  async generateRAGEmbedding(
    text: string,
    isQuery: boolean = false,
    metadata?: MLXTraceMetadata
  ): Promise<number[]> {
    return this.trace(
      'mlx.rag.embedding',
      async (span) => {
        const embedding = await this.provider.generateRAGEmbedding(text, isQuery);

        if (span) {
          span.setTag('mlx.rag.is_query', isQuery);
          span.setTag('mlx.embedding.dimensions', embedding.length);
        }

        return embedding;
      },
      {
        tags: {
          'mlx.operation': 'rag_embedding',
          'mlx.rag.type': isQuery ? 'query' : 'document',
          ...(metadata?.tags || {}),
        },
        context: metadata?.context,
      }
    );
  }

  /**
   * RAG answer generation with full pipeline tracing
   */
  async generateRAGAnswer(
    query: string,
    context: string[],
    options: MLXInferenceOptions = {},
    metadata?: MLXTraceMetadata
  ): Promise<MLXGenerationResult> {
    return this.trace(
      'mlx.rag.answer',
      async (span) => {
        const result = await this.provider.generateRAGAnswer(query, context, options);

        if (span) {
          span.setTag('mlx.rag.context_count', context.length);
          span.setTag('mlx.rag.context_length', context.join('').length);
          span.setTag('mlx.tokens.output', result.metrics.totalTokens);
          span.setTag('mlx.tokens_per_second', result.metrics.tokensPerSecond);
          span.setTag('mlx.finish_reason', result.finishReason);

          if (this.config.logInputOutput) {
            span.setTag('mlx.input.query', this.truncate(query, this.config.maxInputLength));
            span.setTag('mlx.output.answer', this.truncate(result.text, this.config.maxOutputLength));
          }
        }

        return result;
      },
      {
        tags: {
          'mlx.operation': 'rag_answer',
          'mlx.rag.context_count': context.length,
          ...(metadata?.tags || {}),
        },
        context: {
          sessionId: metadata?.sessionId,
          userId: metadata?.userId,
          ...metadata?.context,
        },
      }
    );
  }

  /**
   * Get memory usage with metrics
   */
  async getMemoryUsage(): Promise<{
    used: number;
    total: number;
    modelMemory: number;
    cacheMemory: number;
  }> {
    const memory = await this.provider.getMemoryUsage();

    // Report memory as metrics (these can be collected by Datadog agent)
    if (this.config.enabled) {
      try {
        const statsd = require('hot-shots');
        const client = new statsd({ prefix: 'mlx.' });
        client.gauge('memory.used', memory.used);
        client.gauge('memory.total', memory.total);
        client.gauge('memory.model', memory.modelMemory);
        client.gauge('memory.cache', memory.cacheMemory);
      } catch {
        // StatsD not available, skip metrics
      }
    }

    return memory;
  }

  // MARK: - Tracing Helpers

  /**
   * Generic trace wrapper
   */
  private async trace<T>(
    operationName: string,
    operation: (span?: Span) => Promise<T>,
    options: {
      tags?: Record<string, string | number | boolean | undefined>;
      context?: Record<string, unknown>;
    } = {}
  ): Promise<T> {
    if (!this.config.enabled) {
      return operation(undefined);
    }

    const span = this.startSpan(operationName, options.tags);

    return tracer.scope().activate(span, async () => {
      try {
        if (options.context) {
          Object.entries(options.context).forEach(([key, value]) => {
            if (value !== undefined) {
              span.setTag(`mlx.context.${key}`, String(value));
            }
          });
        }

        const result = await operation(span);

        span.setTag('mlx.status', 'success');
        return result;
      } catch (error) {
        span.setTag('mlx.status', 'error');
        span.setTag('error.message', error instanceof Error ? error.message : String(error));
        span.setTag('error.type', error instanceof Error ? error.constructor.name : 'UnknownError');
        throw error;
      } finally {
        span.finish();
      }
    });
  }

  /**
   * Start a new span
   */
  private startSpan(
    operationName: string,
    tags?: Record<string, string | number | boolean | undefined>
  ): Span {
    const filteredTags: Record<string, string | number | boolean> = {};
    if (tags) {
      Object.entries(tags).forEach(([key, value]) => {
        if (value !== undefined) {
          filteredTags[key] = value;
        }
      });
    }

    return tracer.startSpan(operationName, {
      tags: {
        'service.name': this.config.serviceName,
        'ml.app': this.config.mlApp,
        'ml.framework': 'mlx',
        ...filteredTags,
      },
    });
  }

  /**
   * Truncate string for logging
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength) + '... [truncated]';
  }

  /**
   * Get underlying provider
   */
  getProvider(): MLXProvider {
    return this.provider;
  }

  /**
   * Update tracing configuration
   */
  setConfig(config: Partial<MLXTracingConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// MARK: - Singleton Export

export const mlxTracedProvider = new MLXTracedProvider();

// MARK: - Convenience Functions

/**
 * Create a traced MLX operation wrapper
 */
export function createMLXTracer(config?: Partial<MLXTracingConfig>): MLXTracedProvider {
  return new MLXTracedProvider(mlxProvider, config);
}

/**
 * Trace a custom MLX operation
 */
export async function traceMLXOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  tags?: Record<string, string | number | boolean>
): Promise<T> {
  if (!defaultConfig.enabled) {
    return operation();
  }

  const span = tracer.startSpan(`mlx.custom.${operationName}`, {
    tags: {
      'service.name': defaultConfig.serviceName,
      'ml.app': defaultConfig.mlApp,
      'ml.framework': 'mlx',
      'mlx.operation': operationName,
      ...tags,
    },
  });

  return tracer.scope().activate(span, async () => {
    try {
      const result = await operation();
      span.setTag('mlx.status', 'success');
      return result;
    } catch (error) {
      span.setTag('mlx.status', 'error');
      span.setTag('error.message', error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      span.finish();
    }
  });
}

/**
 * Report MLX metrics to Datadog
 */
export function reportMLXMetrics(metrics: {
  operation: string;
  tokensPerSecond?: number;
  latencyMs?: number;
  memoryBytes?: number;
  success: boolean;
}): void {
  if (!defaultConfig.enabled) {
    return;
  }

  try {
    const statsd = require('hot-shots');
    const client = new statsd({ prefix: 'mlx.' });

    if (metrics.tokensPerSecond !== undefined) {
      client.gauge(`${metrics.operation}.tokens_per_second`, metrics.tokensPerSecond);
    }
    if (metrics.latencyMs !== undefined) {
      client.histogram(`${metrics.operation}.latency_ms`, metrics.latencyMs);
    }
    if (metrics.memoryBytes !== undefined) {
      client.gauge(`${metrics.operation}.memory_bytes`, metrics.memoryBytes);
    }

    client.increment(`${metrics.operation}.${metrics.success ? 'success' : 'error'}`);
  } catch {
    // StatsD not available
    logger.debug('[MLX] StatsD not available for metrics reporting');
  }
}
