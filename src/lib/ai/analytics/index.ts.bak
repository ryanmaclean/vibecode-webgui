import { EventEmitter } from 'events';
import { PerformanceMonitor } from '../../monitoring/performance-monitoring';

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
  private metrics: PerformanceMonitor;
  private events: AnalyticsEvent[] = [];
  private static instance: AIAnalytics;

  private constructor() {
    super();
    this.metrics = PerformanceMonitor.getInstance();
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
      this.metrics.trackOperation('prompt_execution_time', event.duration, event.success, {
        prompt_id: event.promptId,
        success: event.success,
      });
      
    });

    // Track vector search metrics
    this.on('vector_search', (event: { query: string; resultsCount: number; duration: number }) => {
      this.metrics.trackOperation('vector_search_latency', event.duration, true);
      this.metrics.trackOperation('vector_search_results', event.resultsCount, true);
      this.metrics.trackOperation('vector_search_queries', 1, true);
    });

    // Track embedding generation
    this.on('embedding_generated', (event: { inputLength: number; duration: number }) => {
      this.metrics.trackOperation('embedding_generation_time', event.duration, true);
      this.metrics.trackOperation('embedding_input_length', event.inputLength, true);
    });
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
    // This can be expanded to pull stats from the PerformanceMonitor
    return {
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
