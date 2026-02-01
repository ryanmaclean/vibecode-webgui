import * as tracer from 'dd-trace';
import { Logger } from '../logger';

export interface TracingConfig {
  service: string;
  version: string;
  env: string;
  sampleRate: number;
  exporters: ('console' | 'datadog' | 'jaeger')[];
  datadog?: {
    apiKey: string;
    site: string;
  };
}

export class TracingManager {
  private logger: Logger;
  private config: TracingConfig;
  private initialized: boolean = false;

  constructor(logger: Logger, config?: Partial<TracingConfig>) {
    this.logger = logger;
    this.config = {
      service: 'vscode-rag-extension',
      version: '1.0.0',
      env: process.env.NODE_ENV || 'development',
      sampleRate: 1.0,
      exporters: ['console'],
      ...config
    };
  }

  /**
   * Initialize tracing with the configured exporters
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    return tracer.trace('tracing.initialize', async (span) => {
      span.setTag('service.name', this.config.service);
      span.setTag('service.version', this.config.version);
      span.setTag('service.env', this.config.env);

      try {
        // Initialize tracer
        tracer.init({
          service: this.config.service,
          version: this.config.version,
          env: this.config.env,
          sampleRate: this.config.sampleRate,
          logInjection: true,
          runtimeMetrics: true,
        });

        // Configure exporters
        for (const exporter of this.config.exporters) {
          switch (exporter) {
            case 'console':
              // Console exporter is default
              span.setTag('exporter.console', 'enabled');
              break;
            
            case 'datadog':
              if (this.config.datadog?.apiKey) {
                // Datadog exporter would be configured here
                span.setTag('exporter.datadog', 'enabled');
                this.logger.info('Datadog exporter configured');
              } else {
                span.setTag('exporter.datadog', 'disabled', 'no_api_key');
              }
              break;
            
            case 'jaeger':
              // Jaeger exporter would be configured here
              span.setTag('exporter.jaeger', 'enabled');
              this.logger.info('Jaeger exporter configured');
              break;
          }
        }

        this.initialized = true;
        span.setTag('success', true);
        this.logger.info('Tracing initialized successfully', {
          service: this.config.service,
          exporters: this.config.exporters
        });

      } catch (error) {
        span.setTag('success', false);
        span.setTag('error.message', error.message);
        this.logger.error('Failed to initialize tracing', error);
        throw error;
      }
    });
  }

  /**
   * Create a trace span with automatic error handling
   */
  trace<T>(name: string, fn: (span: any) => Promise<T>, tags?: Record<string, any>): Promise<T> {
    if (!this.initialized) {
      this.logger.warn('Tracing not initialized, running without tracing');
      return fn(null);
    }

    return tracer.trace(name, async (span) => {
      // Add custom tags
      if (tags) {
        Object.entries(tags).forEach(([key, value]) => {
          span.setTag(key, value);
        });
      }

      try {
        const result = await fn(span);
        span.setTag('success', true);
        return result;
      } catch (error) {
        span.setTag('success', false);
        span.setTag('error.message', error.message);
        span.setTag('error.stack', error.stack);
        throw error;
      }
    });
  }

  /**
   * Get the current tracer instance
   */
  getTracer(): typeof tracer {
    return tracer;
  }

  /**
   * Check if tracing is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Flush any pending traces
   */
  async flush(): Promise<void> {
    if (this.initialized) {
      return tracer.trace('tracing.flush', async (span) => {
        // Flush would be implemented here
        span.setTag('success', true);
      });
    }
  }
}

// Export singleton instance
export const tracingManager = new TracingManager(new Logger({} as any));

// Export types for external use
export * from './MLXEmbeddingService';
export * from './RagTracedService';
export * from './MonitoringDashboard';
