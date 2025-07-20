/**
 * Analytics Module
 * Provides a unified interface for tracking events and metrics
 * Can be extended to support multiple analytics providers
 */

type Primitive = string | number | boolean | null | undefined;
type NestedObject = { [key: string]: Primitive | Primitive[] | NestedObject | NestedObject[] };

// Types for analytics events
export interface AnalyticsEvent<T extends NestedObject = NestedObject> {
  name: string;
  properties?: T;
  timestamp?: number;
  userId?: string | null;
}

// In-memory store for development (can be replaced with a real analytics service)
const eventBuffer: Array<AnalyticsEvent> = [];

// Configuration
interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
  maxBufferSize: number;
}

const config: AnalyticsConfig = {
  enabled: process.env.NODE_ENV === 'production',
  debug: process.env.NODE_ENV !== 'production',
  maxBufferSize: 100,
};

/**
 * Log an analytics event
 * In production, this would send the event to an analytics service
 * In development, it logs to the console and stores in memory
 */
export function logEvent<T extends NestedObject = NestedObject>(
  name: string, 
  properties: T = {} as T
): void {
  const event: AnalyticsEvent = {
    name,
    properties,
    timestamp: Date.now(),
    // In a real app, you'd get this from your auth context
    // userId: getCurrentUser()?.id,
  };

  // In production, send to your analytics service
  if (config.enabled) {
    // Example: sendToAnalyticsService(event);
    console.log('[Analytics]', event);
  }

  // In development, log to console and buffer
  if (config.debug) {
    console.log(`[Analytics] ${name}`, properties);
    
    // Add to buffer (useful for debugging)
    eventBuffer.push(event);
    
    // Prevent memory leaks by limiting buffer size
    if (eventBuffer.length > config.maxBufferSize) {
      eventBuffer.shift();
    }
  }
}

/**
 * Track performance metrics
 * @param metricName Name of the metric (e.g., 'project_generation_time')
 * @param value Numeric value of the metric
 * @param additionalProps Additional properties to include
 */
export function trackMetric<T extends NestedObject = NestedObject>(
  metricName: string, 
  value: number, 
  additionalProps: T = {} as T
): void {
  logEvent(`metric_${metricName}`, {
    value,
    ...additionalProps,
  });
}

/**
 * Track timing information
 * @param eventName Name of the event
 * @param duration Duration in milliseconds
 * @param additionalProps Additional properties to include
 */
export function trackTiming<T extends NestedObject = NestedObject>(
  eventName: string,
  duration: number,
  additionalProps: T = {} as T
): void {
  logEvent(`timing_${eventName}`, {
    duration,
    ...additionalProps,
  });
}

/**
 * Track errors
 * @param error The error that occurred
 * @param context Additional context about where the error occurred
 */
interface ErrorContext extends NestedObject {
  eventName?: string;
  url?: string;
  duration?: number;
  status?: number;
  method?: string;
}

export function trackError(
  error: Error,
  context: ErrorContext = {}
): void {
  logEvent('error_occurred', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
}

/**
 * Get recent events (for debugging)
 * @param limit Maximum number of events to return
 */
export function getRecentEvents(limit: number = 10): AnalyticsEvent[] {
  return eventBuffer.slice(-limit);
}

/**
 * Initialize analytics
 * Can be used to set up any required configurations
 */
export function initAnalytics(options: {
  enabled?: boolean;
  debug?: boolean;
  userId?: string | null;
} = {}): void {
  if (options.enabled !== undefined) {
    config.enabled = options.enabled;
  }
  if (options.debug !== undefined) {
    config.debug = options.debug;
  }
  
  if (config.enabled || config.debug) {
    console.log('[Analytics] Initialized', { config });
  }
}

// Initialize with default values
initAnalytics();
