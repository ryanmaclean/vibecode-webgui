/**
 * Stub type declarations for LLM Tracer module
 * Used for lite type-checking of AI chat endpoints
 */

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

export declare class LLMTracer {
  /**
   * Wrap an LLM call with comprehensive tracing
   */
  static traceLLMCall<T>(
    operation: string,
    options: LLMSpanOptions,
    fn: () => Promise<T>
  ): Promise<T>;

  /**
   * Track token usage metrics in Datadog
   */
  static trackTokenUsage(
    provider: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
    cost?: number
  ): void;

  /**
   * Create a custom span for AI operations
   */
  static createAISpan(
    operation: string,
    tags?: Record<string, string | number | boolean | undefined>
  ): unknown;
}

export declare function TraceLLM(
  options?: Partial<LLMSpanOptions>
): (target: unknown, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;

declare const tracer: unknown;
export default tracer;
