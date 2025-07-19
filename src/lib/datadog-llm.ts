/**
 * Datadog LLM Observability Configuration
 * Provides monitoring for AI/LLM operations in VibeCode
 */

// Import ddtrace for LLM observability
// NOTE: This must be imported before any other modules that use AI services
import tracer from '../instrument';
import { Span } from 'dd-trace';

interface LLMSpanMetadata {
  tags?: string[];
  input?: unknown;
  output?: unknown;
  context?: Record<string, unknown>;
}

interface LLMObservabilityConfig {
  enabled: boolean;
  agentlessEnabled: boolean;
  mlApp: string;
  site: string;
  apiKey?: string;
  service: string;
  environment: string;
}

class LLMObservability {
  private static instance: LLMObservability;
  private config: LLMObservabilityConfig;

  private constructor() {
    this.config = {
      enabled: process.env.DD_LLMOBS_ENABLED === '1' || false,
      agentlessEnabled: process.env.DD_LLMOBS_AGENTLESS_ENABLED === '1' || true,
      mlApp: process.env.DD_LLMOBS_ML_APP || 'vibecode-ai',
      site: process.env.DD_SITE || process.env.DATADOG_SITE || 'datadoghq.com',
      apiKey: process.env.DD_API_KEY || process.env.DATADOG_API_KEY,
      service: process.env.DD_SERVICE || 'vibecode-webgui',
      environment: process.env.DD_ENV || process.env.NODE_ENV || 'development',
    };
  }

  public static getInstance(): LLMObservability {
    if (!LLMObservability.instance) {
      LLMObservability.instance = new LLMObservability();
    }
    return LLMObservability.instance;
  }

  public createWorkflowSpan<T>(
    name: string,
    operation: (span?: Span) => Promise<T>,
    metadata?: LLMSpanMetadata
  ): Promise<T> {
    if (!this.config.enabled) {
      return operation(undefined);
    }

    try {
      const span = tracer.startSpan(`llm.workflow.${name}`, {
        tags: {
          'llm.operation': 'workflow',
          'llm.name': name,
          'service.name': this.config.service,
          'ml.app': this.config.mlApp,
          ...(Array.isArray(metadata?.tags)
            ? metadata.tags.reduce((acc: Record<string, boolean>, tag: string) => ({ ...acc, [`tag.${tag}`]: true }), {})
            : {}),
        },
      });

      return tracer.scope().activate(span, async () => {
        try {
          if (metadata?.input) {
            span.setTag('llm.input.data', JSON.stringify(metadata.input));
          }

          if (metadata?.context) {
            Object.entries(metadata.context).forEach(([key, value]) => {
              span.setTag(`llm.metadata.${key}`, String(value));
            });
          }

          const result = await operation();

          if (metadata?.output !== undefined) {
            span.setTag('llm.output.data', JSON.stringify(metadata.output));
          }

          span.setTag('llm.status', 'success');
          return result;
        } catch (error) {
          span.setTag('llm.status', 'error');
          span.setTag('error.message', error instanceof Error ? error.message : String(error));
          throw error;
        } finally {
          span.finish();
        }
      });
    } catch (error) {
      console.error('Error in LLM workflow span:', error);
      return operation(undefined);
    }
  }

  public createTaskSpan<T>(
    name: string,
    operation: (span?: Span) => Promise<T>,
    metadata?: LLMSpanMetadata
  ): Promise<T> {
    if (!this.config.enabled) {
      return operation(undefined);
    }

    try {
      const span = tracer.startSpan(`llm.task.${name}`, {
        tags: {
          'llm.operation': 'task',
          'llm.name': name,
          'service.name': this.config.service,
          'ml.app': this.config.mlApp,
          ...(Array.isArray(metadata?.tags)
            ? metadata.tags.reduce((acc: Record<string, boolean>, tag: string) => ({ ...acc, [`tag.${tag}`]: true }), {})
            : {}),
        },
      });

      return tracer.scope().activate(span, async () => {
        try {
          if (metadata?.input) {
            span.setTag('llm.input.data', JSON.stringify(metadata.input));
          }

          if (metadata?.context) {
            Object.entries(metadata.context).forEach(([key, value]) => {
              span.setTag(`llm.metadata.${key}`, String(value));
            });
          }

          const result = await operation();

          if (metadata?.output !== undefined) {
            span.setTag('llm.output.data', JSON.stringify(metadata.output));
          }

          span.setTag('llm.status', 'success');
          return result;
        } catch (error) {
          span.setTag('llm.status', 'error');
          span.setTag('error.message', error instanceof Error ? error.message : String(error));
          throw error;
        } finally {
          span.finish();
        }
      });
    } catch (error) {
      console.error('Error in LLM task span:', error);
      return operation(undefined);
    }
  }

  public annotate(data: {
    input_data?: unknown;
    output_data?: unknown;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): void {
    if (!this.config.enabled) return;

    try {
      const activeSpan = tracer.scope().active();
      if (!activeSpan) {
        console.warn('No active span to annotate for LLM Observability');
        return;
      }

      if (data.input_data) {
        activeSpan.setTag('llm.input.data', JSON.stringify(data.input_data));
      }

      if (data.output_data) {
        activeSpan.setTag('llm.output.data', JSON.stringify(data.output_data));
      }

      if (data.metadata) {
        Object.entries(data.metadata).forEach(([key, value]) => {
          activeSpan.setTag(`llm.metadata.${key}`, String(value));
        });
      }

      if (data.tags) {
        data.tags.forEach(tag => {
          activeSpan.setTag(`tag.${tag}`, true);
        });
      }
    } catch (error) {
      console.error('Error annotating LLM span:', error);
    }
  }

  public flush(): Promise<void> {
    if (!this.config.enabled) return Promise.resolve();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ddTracer = tracer as any;
      return new Promise(resolve => {
        if (ddTracer.tracer?._writer?.flush) {
          ddTracer.tracer._writer.flush(() => {
            console.log('LLM observability data flushed to Datadog');
            resolve();
          });
        } else {
          resolve();
        }
      });
    } catch (error) {
      console.error('Error flushing LLM observability data:', error);
      return Promise.resolve();
    }
  }

  public getConfig(): LLMObservabilityConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const llmObservability = LLMObservability.getInstance();

export default llmObservability;