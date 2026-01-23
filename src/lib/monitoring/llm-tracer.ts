import tracer from '../../instrument';

export interface LLMSpanOptions {
  model: string;
  provider: string;
  input?: string;
  prompt?: string;
  temperature?: number;
  maxTokens?: number;
  userId?: string;
  sessionId?: string;
}

export interface LLMSpanResult {
  output: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
  latency?: number;
}

/**
 * Traces LLM interactions with Datadog LLM observability
 */
export class LLMTracer {
  /**
   * Wrap an LLM call with comprehensive tracing
   */
  static async traceLLMCall<T>(
    operation: string,
    options: LLMSpanOptions,
    fn: () => Promise<T>
  ): Promise<T> {
    const span = tracer.startSpan('llm.completion', {
      tags: {
        // Existing tags
        'llm.request.model': options.model,
        'llm.request.provider': options.provider,
        'llm.operation': operation,
        'llm.temperature': options.temperature,
        'llm.max_tokens': options.maxTokens,
        'user.id': options.userId,
        'session.id': options.sessionId,
        'service.name': 'vibecode-ai',
        'env': process.env.DD_ENV || 'development',

        // Datadog LLM Observability standard tags
        'span.type': 'ai',
        'ai.operation.name': operation,
        'ai.request.provider': options.provider,
        'ai.request.model': options.model,
      }
    });

    const startTime = Date.now();
    
    try {
      // Add input to span if provided
      if (options.input) {
        const trimmed = options.input.substring(0, 1000);
        span.setTag('llm.request.input', trimmed); // Limit to 1000 chars
        span.setTag('ai.input', trimmed);
      }
      if (options.prompt) {
        const trimmed = options.prompt.substring(0, 1000);
        span.setTag('llm.request.prompt', trimmed);
        span.setTag('ai.prompt', trimmed);
      }

      // Execute the LLM call
      const result = await fn();
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      span.setTag('llm.response.latency_ms', latency);
      span.setTag('llm.status', 'success');
      
      // If result has standard structure, extract metrics
      if (typeof result === 'object' && result !== null) {
        const response = result as any;
        
        if (response.output || response.text || response.content) {
          const output = response.output || response.text || response.content;
          const trimmed = String(output).substring(0, 1000);
          span.setTag('llm.response.output', trimmed);
          span.setTag('ai.output', trimmed);
        }
        
        if (response.usage || response.tokenUsage) {
          const usage = response.usage || response.tokenUsage;
          span.setTag('llm.usage.prompt_tokens', usage.promptTokens || usage.prompt_tokens);
          span.setTag('llm.usage.completion_tokens', usage.completionTokens || usage.completion_tokens);
          span.setTag('llm.usage.total_tokens', usage.totalTokens || usage.total_tokens);
          if (usage.total_tokens) {
            span.setTag('ai.response.total_tokens', usage.total_tokens);
          }
        }
        
        if (response.cost) {
          span.setTag('llm.cost.total', response.cost);
        }
      }
      
      span.finish();
      return result;
      
    } catch (error: unknown) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      span.setTag('llm.response.latency_ms', latency);
      span.setTag('llm.status', 'error');
      span.setTag('error', true);
      span.setTag('error.message', error instanceof Error ? error.message : 'Unknown error');
      span.setTag('error.type', error instanceof Error ? error.constructor.name : 'Unknown');
      
      span.finish();
      throw error;
    }
  }

  /**
   * Track token usage metrics
   */
  static trackTokenUsage(
    provider: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
    cost?: number
  ) {
    // Send custom metrics to Datadog
    const statsd = tracer.dogstatsd;
    if (statsd) {
      statsd.increment('llm.requests.total', 1, {
        provider,
        model,
        env: process.env.DD_ENV || 'development'
      });
      
      statsd.histogram('llm.tokens.prompt', promptTokens, {
        provider,
        model
      });
      
      statsd.histogram('llm.tokens.completion', completionTokens, {
        provider,
        model
      });
      
      statsd.histogram('llm.tokens.total', promptTokens + completionTokens, {
        provider,
        model
      });
      
      if (cost) {
        statsd.histogram('llm.cost.total', cost, {
          provider,
          model
        });
      }
    }
  }

  /**
   * Create a custom span for AI operations
   */
  static createAISpan(operation: string, tags: Record<string, any> = {}) {
    return tracer.startSpan(`ai.${operation}`, {
      tags: {
        'service.name': 'vibecode-ai',
        'env': process.env.DD_ENV || 'development',
        ...tags
      }
    });
  }
}

/**
 * Decorator for automatic LLM tracing
 */
export function TraceLLM(options: Partial<LLMSpanOptions> = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const spanOptions: LLMSpanOptions = {
        model: options.model || 'unknown',
        provider: options.provider || 'unknown',
        ...options
      };
      
      return LLMTracer.traceLLMCall(
        `${target.constructor.name}.${propertyName}`,
        spanOptions,
        () => method.apply(this, args)
      );
    };
    
    return descriptor;
  };
}
export default tracer;
