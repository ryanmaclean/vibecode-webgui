/**
 * Performance Monitoring Module
 * 
 * Provides comprehensive performance tracking for the VibeCode platform
 * Integrates with Datadog for real-time performance metrics
 */

// Import monitoring client
const datadogClient = {
  submitMetric: (metric: any) => {
    // Mock implementation for now
    console.log('Submitting metric:', metric);
  }
};

interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetrics[]> = new Map();

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Track operation performance
   */
  public trackOperation(operation: string, duration: number, success: boolean, metadata?: Record<string, any>) {
    const metric: PerformanceMetrics = {
      operation,
      duration,
      success,
      metadata
    };

    // Store locally
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(metric);

    // Send to Datadog
    datadogClient.submitMetric({
      metric: `vibecode.performance.${operation}`,
      points: [[Date.now(), duration]],
      tags: [
        `operation:${operation}`,
        `success:${success}`,
        ...Object.entries(metadata || {}).map(([k, v]) => `${k}:${v}`)
      ]
    });
  }

  /**
   * Get performance statistics
   */
  public getStats(operation: string): {
    average: number;
    min: number;
    max: number;
    successRate: number;
    totalRequests: number;
  } | null {
    const metrics = this.metrics.get(operation);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const durations = metrics.map(m => m.duration);
    const successCount = metrics.filter(m => m.success).length;

    return {
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      successRate: successCount / metrics.length,
      totalRequests: metrics.length
    };
  }

  /**
   * Clear metrics for an operation
   */
  public clearMetrics(operation: string) {
    this.metrics.delete(operation);
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();