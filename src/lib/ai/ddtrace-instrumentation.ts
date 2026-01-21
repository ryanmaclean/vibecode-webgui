/**
 * Datadog Tracing Instrumentation for AI Services
 * Issue #886: Deep Datadog LLM Observability
 */

import tracer from 'dd-trace';

// Initialize tracer if not already done
// Use type assertion since isStarted may not be in types but exists at runtime
if (!(tracer as any)._initialized) {
  tracer.init({
    service: 'vibecode-ai',
    env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
    version: process.env.DD_VERSION || '1.0.0',
    logInjection: true,
  });
}

/**
 * Trace an LLM call with Datadog spans
 */
export function traceLLMCall<T>(
  operationName: string,
  metadata: {
    model?: string;
    provider?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  },
  fn: () => Promise<T>
): Promise<T> {
  return tracer.trace(`llm.${operationName}`, async (span) => {
    if (span) {
      span.setTag('llm.model', metadata.model || 'unknown');
      span.setTag('llm.provider', metadata.provider || 'unknown');
      span.setTag('resource.name', operationName);

      if (metadata.promptTokens !== undefined) {
        span.setTag('llm.prompt_tokens', metadata.promptTokens);
      }
      if (metadata.completionTokens !== undefined) {
        span.setTag('llm.completion_tokens', metadata.completionTokens);
      }
      if (metadata.totalTokens !== undefined) {
        span.setTag('llm.total_tokens', metadata.totalTokens);
      }
    }

    try {
      const result = await fn();
      if (span) {
        span.setTag('llm.success', true);
      }
      return result;
    } catch (error) {
      if (span) {
        span.setTag('llm.success', false);
        span.setTag('error', true);
        span.setTag('error.message', error instanceof Error ? error.message : String(error));
      }
      throw error;
    }
  });
}

/**
 * Trace an embedding call
 */
export function traceEmbedding<T>(
  provider: string,
  dimensions: number,
  fn: () => Promise<T>
): Promise<T> {
  return tracer.trace('embedding.generate', async (span) => {
    if (span) {
      span.setTag('embedding.provider', provider);
      span.setTag('embedding.dimensions', dimensions);
      span.setTag('resource.name', `embedding.${provider}`);
    }

    try {
      const result = await fn();
      if (span) {
        span.setTag('embedding.success', true);
      }
      return result;
    } catch (error) {
      if (span) {
        span.setTag('embedding.success', false);
        span.setTag('error', true);
        span.setTag('error.message', error instanceof Error ? error.message : String(error));
      }
      throw error;
    }
  });
}

/**
 * Track token usage metrics
 */
export function trackTokenUsage(metrics: {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}): void {
  const activeSpan = tracer.scope().active();
  if (activeSpan) {
    activeSpan.setTag('llm.model', metrics.model);
    activeSpan.setTag('llm.prompt_tokens', metrics.promptTokens);
    activeSpan.setTag('llm.completion_tokens', metrics.completionTokens);
    activeSpan.setTag('llm.total_tokens', metrics.totalTokens);
    if (metrics.cost !== undefined) {
      activeSpan.setTag('llm.cost_usd', metrics.cost);
    }
  }
}

export { tracer };
