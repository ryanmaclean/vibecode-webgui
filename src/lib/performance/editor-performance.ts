/**
 * Editor Performance Tracking System
 * Monitors and tracks editor-specific performance metrics
 */

import { monitoring } from '../monitoring';

interface EditorMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'lines';
  tags?: string[];
  timestamp?: number;
}

interface EditorLoadMetric {
  editor_id: string;
  load_time: number;
  file_size?: number;
  line_count?: number;
  language?: string;
  timestamp: number;
}

interface FileOperationMetric {
  operation: 'open' | 'save' | 'close';
  file_path: string;
  file_size: number;
  line_count: number;
  duration: number;
  language?: string;
  success: boolean;
  timestamp: number;
}

interface EditorOperationMetric {
  operation: 'undo' | 'redo' | 'find' | 'replace' | 'format' | 'highlight';
  duration: number;
  context?: {
    file_size?: number;
    line_count?: number;
    selection_size?: number;
  };
  success: boolean;
  timestamp: number;
}

interface LargeFileMetric {
  file_path: string;
  file_size: number;
  line_count: number;
  load_time: number;
  render_time: number;
  memory_used: number;
  chunked: boolean;
  timestamp: number;
}

export class EditorPerformanceTracker {
  private static instance: EditorPerformanceTracker;
  private metrics: EditorMetric[] = [];
  private loadMetrics: EditorLoadMetric[] = [];
  private fileOperationMetrics: FileOperationMetric[] = [];
  private editorOperationMetrics: EditorOperationMetric[] = [];
  private largeFileMetrics: LargeFileMetric[] = [];

  private readonly BUFFER_SIZE = 500;
  private readonly MAX_METRICS = 1000;

  static getInstance(): EditorPerformanceTracker {
    if (!EditorPerformanceTracker.instance) {
      EditorPerformanceTracker.instance = new EditorPerformanceTracker();
    }
    return EditorPerformanceTracker.instance;
  }

  /**
   * Track editor load time
   */
  trackEditorLoad(editorId: string, loadTime: number, options?: {
    fileSize?: number;
    lineCount?: number;
    language?: string;
  }) {
    const metric: EditorLoadMetric = {
      editor_id: editorId,
      load_time: loadTime,
      file_size: options?.fileSize,
      line_count: options?.lineCount,
      language: options?.language,
      timestamp: Date.now()
    };

    this.loadMetrics.push(metric);
    this.pruneBuffer(this.loadMetrics);

    const tags = [
      `editor_id:${editorId}`,
      'service:vibecode-webgui',
      'component:editor'
    ];

    if (options?.language) {
      tags.push(`language:${options.language}`);
    }

    if (options?.fileSize) {
      tags.push(`file_size_category:${this.categorizeFileSize(options.fileSize)}`);
    }

    // Submit to Datadog
    monitoring.submitMetric({
      metric: 'vibecode.editor.load_time',
      value: loadTime,
      tags
    });

    // Track as general metric
    this.recordMetric({
      name: 'editor.load_time',
      value: loadTime,
      unit: 'ms',
      tags
    });
  }

  /**
   * Track file operations (open, save, close)
   */
  trackFileOperation(
    operation: 'open' | 'save' | 'close',
    filePath: string,
    duration: number,
    options?: {
      fileSize?: number;
      lineCount?: number;
      language?: string;
      success?: boolean;
    }
  ) {
    const metric: FileOperationMetric = {
      operation,
      file_path: filePath,
      file_size: options?.fileSize || 0,
      line_count: options?.lineCount || 0,
      duration,
      language: options?.language,
      success: options?.success !== false,
      timestamp: Date.now()
    };

    this.fileOperationMetrics.push(metric);
    this.pruneBuffer(this.fileOperationMetrics);

    const tags = [
      `operation:${operation}`,
      `success:${metric.success}`,
      'service:vibecode-webgui',
      'component:editor'
    ];

    if (options?.language) {
      tags.push(`language:${options.language}`);
    }

    if (options?.fileSize) {
      tags.push(`file_size_category:${this.categorizeFileSize(options.fileSize)}`);
    }

    // Submit to Datadog
    monitoring.submitMetric({
      metric: `vibecode.editor.file.${operation}`,
      value: duration,
      tags
    });

    // Track success/failure counts
    monitoring.submitMetric({
      metric: `vibecode.editor.file.${operation}.count`,
      value: 1,
      tags
    });

    // Record general metric
    this.recordMetric({
      name: `editor.file.${operation}`,
      value: duration,
      unit: 'ms',
      tags
    });

    // Log slow operations
    if (duration > 3000) {
      monitoring.submitEvent(
        `Slow file ${operation}`,
        `File ${operation} took ${duration}ms for ${filePath}`,
        [...tags, 'alert_type:warning']
      );
    }
  }

  /**
   * Track editor operations (undo, redo, find, replace, etc.)
   */
  trackEditorOperation(
    operation: 'undo' | 'redo' | 'find' | 'replace' | 'format' | 'highlight',
    duration: number,
    options?: {
      fileSize?: number;
      lineCount?: number;
      selectionSize?: number;
      success?: boolean;
    }
  ) {
    const metric: EditorOperationMetric = {
      operation,
      duration,
      context: {
        file_size: options?.fileSize,
        line_count: options?.lineCount,
        selection_size: options?.selectionSize
      },
      success: options?.success !== false,
      timestamp: Date.now()
    };

    this.editorOperationMetrics.push(metric);
    this.pruneBuffer(this.editorOperationMetrics);

    const tags = [
      `operation:${operation}`,
      `success:${metric.success}`,
      'service:vibecode-webgui',
      'component:editor'
    ];

    if (options?.fileSize) {
      tags.push(`file_size_category:${this.categorizeFileSize(options.fileSize)}`);
    }

    // Submit to Datadog
    monitoring.submitMetric({
      metric: `vibecode.editor.operation.${operation}`,
      value: duration,
      tags
    });

    monitoring.submitMetric({
      metric: `vibecode.editor.operation.${operation}.count`,
      value: 1,
      tags
    });

    // Record general metric
    this.recordMetric({
      name: `editor.operation.${operation}`,
      value: duration,
      unit: 'ms',
      tags
    });
  }

  /**
   * Track large file handling performance
   */
  trackLargeFileHandling(
    filePath: string,
    fileSize: number,
    lineCount: number,
    loadTime: number,
    renderTime: number,
    options?: {
      memoryUsed?: number;
      chunked?: boolean;
    }
  ) {
    const metric: LargeFileMetric = {
      file_path: filePath,
      file_size: fileSize,
      line_count: lineCount,
      load_time: loadTime,
      render_time: renderTime,
      memory_used: options?.memoryUsed || 0,
      chunked: options?.chunked || false,
      timestamp: Date.now()
    };

    this.largeFileMetrics.push(metric);
    this.pruneBuffer(this.largeFileMetrics);

    const tags = [
      `file_size_category:${this.categorizeFileSize(fileSize)}`,
      `chunked:${metric.chunked}`,
      'service:vibecode-webgui',
      'component:editor',
      'type:large_file'
    ];

    // Submit load time
    monitoring.submitMetric({
      metric: 'vibecode.editor.large_file.load_time',
      value: loadTime,
      tags
    });

    // Submit render time
    monitoring.submitMetric({
      metric: 'vibecode.editor.large_file.render_time',
      value: renderTime,
      tags
    });

    // Submit memory usage if available
    if (options?.memoryUsed) {
      monitoring.submitMetric({
        metric: 'vibecode.editor.large_file.memory_used',
        value: options.memoryUsed,
        tags
      });
    }

    // Submit file size and line count for analysis
    monitoring.submitMetric({
      metric: 'vibecode.editor.large_file.size',
      value: fileSize,
      tags
    });

    monitoring.submitMetric({
      metric: 'vibecode.editor.large_file.lines',
      value: lineCount,
      tags
    });

    // Record general metrics
    this.recordMetric({
      name: 'editor.large_file.load_time',
      value: loadTime,
      unit: 'ms',
      tags
    });

    this.recordMetric({
      name: 'editor.large_file.render_time',
      value: renderTime,
      unit: 'ms',
      tags
    });

    // Alert if performance is poor
    if (loadTime > 10000 || renderTime > 5000) {
      monitoring.submitEvent(
        'Large file performance issue',
        `Large file (${fileSize} bytes, ${lineCount} lines) took ${loadTime}ms to load and ${renderTime}ms to render`,
        [...tags, 'alert_type:warning']
      );
    }
  }

  /**
   * Get performance summary for editor operations
   */
  getPerformanceSummary(timeframe = '1h'): {
    editor_loads: {
      count: number;
      avg_time: number;
      p95_time: number;
    };
    file_operations: {
      open: { count: number; avg_time: number; success_rate: number };
      save: { count: number; avg_time: number; success_rate: number };
      close: { count: number; avg_time: number; success_rate: number };
    };
    editor_operations: {
      [key: string]: { count: number; avg_time: number; success_rate: number };
    };
    large_files: {
      count: number;
      avg_load_time: number;
      avg_render_time: number;
      chunked_rate: number;
    };
  } {
    const recentLoadMetrics = this.getRecentMetrics(this.loadMetrics, timeframe);
    const recentFileOps = this.getRecentMetrics(this.fileOperationMetrics, timeframe);
    const recentEditorOps = this.getRecentMetrics(this.editorOperationMetrics, timeframe);
    const recentLargeFiles = this.getRecentMetrics(this.largeFileMetrics, timeframe);

    // Editor loads summary
    const loadTimes = recentLoadMetrics.map(m => m.load_time);
    const editor_loads = {
      count: recentLoadMetrics.length,
      avg_time: this.calculateAverage(loadTimes),
      p95_time: this.calculatePercentile(loadTimes, 95)
    };

    // File operations summary
    const file_operations = {
      open: this.summarizeFileOperations(recentFileOps, 'open'),
      save: this.summarizeFileOperations(recentFileOps, 'save'),
      close: this.summarizeFileOperations(recentFileOps, 'close')
    };

    // Editor operations summary
    const editor_operations: { [key: string]: { count: number; avg_time: number; success_rate: number } } = {};
    const operationTypes = ['undo', 'redo', 'find', 'replace', 'format', 'highlight'];

    operationTypes.forEach(opType => {
      const ops = recentEditorOps.filter(m => m.operation === opType);
      if (ops.length > 0) {
        const durations = ops.map(m => m.duration);
        const successCount = ops.filter(m => m.success).length;

        editor_operations[opType] = {
          count: ops.length,
          avg_time: this.calculateAverage(durations),
          success_rate: (successCount / ops.length) * 100
        };
      }
    });

    // Large files summary
    const large_files = {
      count: recentLargeFiles.length,
      avg_load_time: this.calculateAverage(recentLargeFiles.map(m => m.load_time)),
      avg_render_time: this.calculateAverage(recentLargeFiles.map(m => m.render_time)),
      chunked_rate: recentLargeFiles.length > 0
        ? (recentLargeFiles.filter(m => m.chunked).length / recentLargeFiles.length) * 100
        : 0
    };

    return {
      editor_loads,
      file_operations,
      editor_operations,
      large_files
    };
  }

  /**
   * Get slowest operations
   */
  getSlowestOperations(limit = 10): Array<{
    operation: string;
    avg_duration: number;
    count: number;
    type: 'file' | 'editor';
  }> {
    const operations: Array<{
      operation: string;
      avg_duration: number;
      count: number;
      type: 'file' | 'editor';
    }> = [];

    // File operations
    const fileOpGroups = this.groupFileOperations(this.fileOperationMetrics);
    fileOpGroups.forEach((ops, operation) => {
      const durations = ops.map(m => m.duration);
      operations.push({
        operation: `file.${operation}`,
        avg_duration: this.calculateAverage(durations),
        count: ops.length,
        type: 'file'
      });
    });

    // Editor operations
    const editorOpGroups = this.groupEditorOperations(this.editorOperationMetrics);
    editorOpGroups.forEach((ops, operation) => {
      const durations = ops.map(m => m.duration);
      operations.push({
        operation: `editor.${operation}`,
        avg_duration: this.calculateAverage(durations),
        count: ops.length,
        type: 'editor'
      });
    });

    return operations
      .sort((a, b) => b.avg_duration - a.avg_duration)
      .slice(0, limit);
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clearMetrics() {
    this.metrics = [];
    this.loadMetrics = [];
    this.fileOperationMetrics = [];
    this.editorOperationMetrics = [];
    this.largeFileMetrics = [];
  }

  private recordMetric(metric: EditorMetric) {
    metric.timestamp = metric.timestamp || Date.now();
    this.metrics.push(metric);
    this.pruneBuffer(this.metrics);
  }

  private pruneBuffer<T>(buffer: T[]) {
    if (buffer.length > this.MAX_METRICS) {
      buffer.splice(0, buffer.length - this.MAX_METRICS);
    }
  }

  private categorizeFileSize(size: number): string {
    if (size < 100 * 1024) return 'small'; // < 100KB
    if (size < 1024 * 1024) return 'medium'; // < 1MB
    if (size < 10 * 1024 * 1024) return 'large'; // < 10MB
    return 'very_large'; // >= 10MB
  }

  private getRecentMetrics<T extends { timestamp: number }>(
    metrics: T[],
    timeframe: string
  ): T[] {
    const now = Date.now();
    const timeframeMs = this.parseTimeframe(timeframe);
    return metrics.filter(m => (now - m.timestamp) <= timeframeMs);
  }

  private parseTimeframe(timeframe: string): number {
    const match = timeframe.match(/(\d+)([hmd])/);
    if (!match) return 3600000; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 3600000;
    }
  }

  private calculateAverage(values: number[]): number {
    return values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  private summarizeFileOperations(
    metrics: FileOperationMetric[],
    operation: 'open' | 'save' | 'close'
  ): { count: number; avg_time: number; success_rate: number } {
    const ops = metrics.filter(m => m.operation === operation);

    if (ops.length === 0) {
      return { count: 0, avg_time: 0, success_rate: 0 };
    }

    const durations = ops.map(m => m.duration);
    const successCount = ops.filter(m => m.success).length;

    return {
      count: ops.length,
      avg_time: this.calculateAverage(durations),
      success_rate: (successCount / ops.length) * 100
    };
  }

  private groupFileOperations(
    metrics: FileOperationMetric[]
  ): Map<string, FileOperationMetric[]> {
    const groups = new Map<string, FileOperationMetric[]>();

    metrics.forEach(metric => {
      const existing = groups.get(metric.operation) || [];
      existing.push(metric);
      groups.set(metric.operation, existing);
    });

    return groups;
  }

  private groupEditorOperations(
    metrics: EditorOperationMetric[]
  ): Map<string, EditorOperationMetric[]> {
    const groups = new Map<string, EditorOperationMetric[]>();

    metrics.forEach(metric => {
      const existing = groups.get(metric.operation) || [];
      existing.push(metric);
      groups.set(metric.operation, existing);
    });

    return groups;
  }
}

// Export singleton instance
export const editorPerformanceTracker = EditorPerformanceTracker.getInstance();

// Export for external usage
export default editorPerformanceTracker;
