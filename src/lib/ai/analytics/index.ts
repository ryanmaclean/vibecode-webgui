import { EventEmitter } from 'events';
import { MetricsCollector } from '../../metrics';

type MetricEvent = {
  name: string;
  value: number;
  timestamp: Date;
  metadata?: Record<string, any>;
};

type AnalyticsEvent = {
  type: string;
  payload: any;
  timestamp: Date;
};

export class AIAnalytics extends EventEmitter {
  private metrics: MetricsCollector;
  private events: AnalyticsEvent[] = [];
  private static instance: AIAnalytics;

  private constructor() {
    super();
    this.metrics = new MetricsCollector('ai_analytics');
    this.setupEventHandlers();
  }

  public static getInstance(): AIAnalytics {
    if (!AIAnalytics.instance) {
      AIAnalytics.instance = new AIAnalytics();
    }
    return AIAnalytics.instance;
  }

  private setupEventHandlers() {
    // Track prompt execution metrics
    this.on('prompt_executed', (event: { promptId: string; duration: number; success: boolean }) => {
      this.recordMetric('prompt_execution_time', event.duration, {
        prompt_id: event.promptId,
        success: event.success,
      });
      this.incrementCounter(
        event.success ? 'prompt_success' : 'prompt_failure',
        { prompt_id: event.promptId }
      );
    });

    // Track vector search metrics
    this.on('vector_search', (event: { query: string; resultsCount: number; duration: number }) => {
      this.recordMetric('vector_search_latency', event.duration);
      this.recordMetric('vector_search_results', event.resultsCount);
      this.incrementCounter('vector_search_queries');
    });

    // Track embedding generation
    this.on('embedding_generated', (event: { inputLength: number; duration: number }) => {
      this.recordMetric('embedding_generation_time', event.duration);
      this.recordMetric('embedding_input_length', event.inputLength);
    });
  }

  recordMetric(name: string, value: number, metadata: Record<string, any> = {}) {
    const metric: MetricEvent = {
      name,
      value,
      timestamp: new Date(),
      metadata,
    };

    // Send to metrics collector
    this.metrics.recordMetric(name, value, metadata);
    
    // Emit event for any listeners
    this.emit('metric_recorded', metric);
    
    return metric;
  }

  incrementCounter(name: string, metadata: Record<string, any> = {}) {
    this.metrics.incrementCounter(name, metadata);
    this.emit('counter_incremented', { name, metadata, timestamp: new Date() });
  }

  logEvent(type: string, payload: any = {}) {
    const event: AnalyticsEvent = {
      type,
      payload,
      timestamp: new Date(),
    };
    
    this.events.push(event);
    this.emit('event_logged', event);
    
    // Keep only the last 1000 events in memory
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
    
    return event;
  }

  getRecentEvents(limit = 50): AnalyticsEvent[] {
    return this.events.slice(-limit).reverse();
  }

  getMetricsSummary() {
    return {
      promptExecutions: this.metrics.getCounter('prompt_success') + this.metrics.getCounter('prompt_failure'),
      promptSuccessRate: this.metrics.getCounter('prompt_success') / 
        (this.metrics.getCounter('prompt_success') + this.metrics.getCounter('prompt_failure') || 1),
      vectorSearches: this.metrics.getCounter('vector_search_queries'),
      averageSearchLatency: this.metrics.getMetric('vector_search_latency')?.avg || 0,
      totalEvents: this.events.length,
      timestamp: new Date(),
    };
  }

  // Integration with error tracking
  trackError(error: Error, context: Record<string, any> = {}) {
    const errorEvent = {
      type: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      timestamp: new Date(),
    };
    
    this.logEvent('error', errorEvent);
    this.emit('error_occurred', errorEvent);
    
    // Also send to error tracking service if configured
    if (process.env.ERROR_TRACKING_DSN) {
      this.sendToErrorTracking(errorEvent);
    }
    
    return errorEvent;
  }

  private async sendToErrorTracking(event: any) {
    try {
      // Integrate with error tracking service (e.g., Sentry, Datadog)
      // This is a simplified example
      if (process.env.ERROR_TRACKING_DSN) {
        await fetch(process.env.ERROR_TRACKING_DSN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });
      }
    } catch (error) {
      console.error('Failed to send error to tracking service:', error);
    }
  }
}

// Export singleton instance
export const aiAnalytics = AIAnalytics.getInstance();
