import tracer from 'dd-trace';

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
    const mlApp = process.env.DD_LLMOBS_ML_APP || 'vibecode-ai';
    const ddService = process.env.DD_SERVICE || 'vibecode-webgui';
    const env = process.env.DD_ENV || 'development';

    return tracer.trace('llm.completion', {
      service: `${ddService}-openai`,
      resource: options.model || operation,
      type: 'custom',
      tags: {
        'llm.request.model': options.model,
        'llm.request.provider': options.provider,
        'llm.operation': operation,
        'llm.temperature': options.temperature,
        'llm.max_tokens': options.maxTokens,
        'user.id': options.userId,
        'session.id': options.sessionId,
        'service.name': `${ddService}-openai`,
        'env': env,
        'ml.app': mlApp,
        'ml_app': mlApp,
        'component': 'LLMTracer'
      }
    }, async span => {
      const activeSpan = span ?? tracer.scope().active();
      if (!activeSpan) {
        return fn();
      }
      const startTime = Date.now();
      try {
        if (options.input) {
          activeSpan.setTag('llm.request.input', options.input.substring(0, 1000));
        }
        if (options.prompt) {
          activeSpan.setTag('llm.request.prompt', options.prompt.substring(0, 1000));
        }

        const result = await fn();
        const response = (result as any)?.response ?? result;
        const modelUsed = (result as any)?.modelUsed ?? response?.model ?? options.model;
        const providerUsed = (result as any)?.provider ?? options.provider;

        const latency = Date.now() - startTime;

        if (modelUsed) {
          activeSpan.setTag('llm.response.model_used', modelUsed);
        }
        if (providerUsed) {
          activeSpan.setTag('llm.response.provider', providerUsed);
        }

        activeSpan.setTag('llm.response.latency_ms', latency);
        activeSpan.setTag('llm.status', 'success');

        if (typeof response === 'object' && response !== null) {
          const output = response.output || response.text || response.content;
          if (typeof output === 'string') {
            activeSpan.setTag('llm.response.output', output.substring(0, 1000));
          }

          const usage = response.usage || response.tokenUsage;
          if (usage) {
            const promptTokens = usage.promptTokens ?? usage.prompt_tokens;
            const completionTokens = usage.completionTokens ?? usage.completion_tokens;
            const totalTokens = usage.totalTokens ?? usage.total_tokens ?? (promptTokens && completionTokens ? promptTokens + completionTokens : undefined);

            if (promptTokens !== undefined) activeSpan.setTag('llm.usage.prompt_tokens', promptTokens);
            if (completionTokens !== undefined) activeSpan.setTag('llm.usage.completion_tokens', completionTokens);
            if (totalTokens !== undefined) activeSpan.setTag('llm.usage.total_tokens', totalTokens);
          }

          if (response.cost !== undefined) {
            activeSpan.setTag('llm.cost.total', response.cost);
          }
        }

        return result;
      } catch (error: any) {
        const latency = Date.now() - startTime;
        activeSpan.setTag('llm.response.latency_ms', latency);
        activeSpan.setTag('llm.status', 'error');
        activeSpan.setTag('error', true);
        activeSpan.setTag('error.message', error?.message);
        activeSpan.setTag('error.type', error?.constructor?.name || typeof error);
        throw error;
      }
    });
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
