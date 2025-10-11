/**
 * Datadog LLM Observability Configuration
 * Provides monitoring for AI/LLM operations in VibeCode
 */

// Import ddtrace for LLM observability
// NOTE: This must be imported before any other modules that use AI services
<<<<<<< HEAD
// Use createRequire for compatibility in ESM context
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
=======
// Using CommonJS require because '../instrument' exports via module.exports
>>>>>>> fix/consolidated-dependency-updates
const tracer = require('../instrument')
import { Span } from 'dd-trace'
import { getDatadogSite, getDatadogApiKey, getServiceEnvVersion } from '@/lib/monitoring/datadog-env'

// Small helper to parse boolean-like env flags safely
function parseFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue
  const normalized = String(value).trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

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
    const { service, env } = getServiceEnvVersion()
    this.config = {
      enabled: parseFlag(process.env.DD_LLMOBS_ENABLED, false),
      agentlessEnabled: parseFlag(process.env.DD_LLMOBS_AGENTLESS_ENABLED, true),
      mlApp: process.env.DD_LLMOBS_ML_APP || 'vibecode-ai',
      site: getDatadogSite(),
      apiKey: getDatadogApiKey(),
      service,
      environment: env,
    }
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
          // Legacy/custom tags we already used
          'llm.operation': 'workflow',
          'llm.name': name,
          'service.name': this.config.service,
          'ml.app': this.config.mlApp,

          // Datadog LLM Observability standard tags
          'span.type': 'ai',
          'ai.operation.name': 'workflow',
          'ai.application.name': this.config.mlApp,
          'ai.request.provider': 'openai',
          // model is set by callers via annotate() or options, defaults
          ...(Array.isArray(metadata?.tags)
            ? metadata.tags.reduce((acc: Record<string, boolean>, tag: string) => ({ ...acc, [`tag.${tag}`]: true }), {})
            : {}),
        },
      });

      return tracer.scope().activate(span, async () => {
        try {
          if (metadata?.input) {
            span.setTag('llm.input.data', JSON.stringify(metadata.input));
            span.setTag('ai.input', JSON.stringify(metadata.input));
          }

          if (metadata?.context) {
            Object.entries(metadata.context).forEach(([key, value]) => {
              span.setTag(`llm.metadata.${key}`, String(value));
            });
          }

          const result = await operation();

          if (metadata?.output !== undefined) {
            span.setTag('llm.output.data', JSON.stringify(metadata.output));
            span.setTag('ai.output', JSON.stringify(metadata.output));
          }

          span.setTag('llm.status', 'success');
          return result;
        } catch (error) {
          span.setTag('llm.status', 'error');
          span.setTag('error', true);
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
      // Use dd-trace scope manager to read the active span
      const scopeProvider =
        typeof tracer.scope === 'function'
          ? tracer.scope()
          : typeof (tracer as any).scope === 'object'
            ? (tracer as any).scope
            : typeof (tracer as any).scopeManager === 'function'
              ? (tracer as any).scopeManager()
              : null;

      const activeSpan = scopeProvider && typeof scopeProvider.active === 'function'
        ? scopeProvider.active()
        : null;
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
      const ddTracer = tracer as any;
      return new Promise(resolve => {
        if (ddTracer.tracer?._writer?.flush) {
          ddTracer.tracer._writer.flush(() => {
            // Debug log removed
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
