/**
 * Memory Monitoring Utilities for Editor Performance
 *
 * Provides browser-based memory monitoring specifically for tracking
 * editor performance with large files. Monitors:
 * - JavaScript heap usage (Chrome/Chromium browsers)
 * - Editor-specific memory consumption
 * - Performance thresholds and warnings
 * - Memory leak detection
 *
 * Integrates with the logging infrastructure at src/lib/logging/
 * and provides real-time tracking for editor operations.
 *
 * @example
 * ```typescript
 * import {
 *   getMemorySnapshot,
 *   trackMemoryUsage,
 *   withMemoryTracking,
 *   MemoryMonitor
 * } from '@/lib/performance/memory-monitor';
 *
 * // Get a memory snapshot
 * const snapshot = getMemorySnapshot();
 * console.log(`Heap: ${snapshot.usedJSHeapSizeMB}MB`);
 *
 * // Track memory around an operation
 * const result = await withMemoryTracking('file-load', async () => {
 *   return loadLargeFile();
 * });
 *
 * // Create a monitor instance
 * const monitor = new MemoryMonitor({ warnThresholdMB: 512 });
 * monitor.start();
 * await performEditorOperation();
 * const report = monitor.stop();
 * ```
 */

import { createLogger } from '@/lib/logger';
import { formatBytes, formatDuration, type LogMetadata } from '@/lib/logging/format';

// ============================================================================
// Types
// ============================================================================

/**
 * Browser memory performance information
 * Based on performance.memory API (Chrome/Chromium)
 */
export interface BrowserMemoryInfo {
  /** Total size of the JS heap including free space */
  totalJSHeapSize: number;
  /** Total size allocated for the JS heap */
  jsHeapSizeLimit: number;
  /** Currently used JS heap size */
  usedJSHeapSize: number;
  /** Whether performance.memory API is available */
  supported: boolean;
}

/**
 * Memory snapshot with formatted values
 */
export interface MemorySnapshot {
  /** Raw browser memory info */
  browserMemory: BrowserMemoryInfo;
  /** Used JS heap size in MB */
  usedJSHeapSizeMB: number;
  /** Total JS heap size in MB */
  totalJSHeapSizeMB: number;
  /** Heap size limit in MB */
  jsHeapSizeLimitMB: number;
  /** Percentage of heap used */
  heapUsagePercent: number;
  /** Formatted used heap size string */
  formattedUsedHeap: string;
  /** Formatted total heap size string */
  formattedTotalHeap: string;
  /** Timestamp of snapshot */
  timestamp: number;
}

/**
 * Memory delta between two snapshots
 */
export interface MemoryDelta {
  /** Delta in bytes */
  deltaBytes: number;
  /** Delta in MB */
  deltaMB: number;
  /** Formatted delta string */
  formattedDelta: string;
  /** Whether memory increased */
  increased: boolean;
  /** Percentage change */
  percentChange: number;
}

/**
 * Memory tracking result
 */
export interface MemoryTrackingResult<T> {
  /** Result of the tracked operation */
  result: T;
  /** Operation name */
  operation: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Memory delta */
  memoryDelta: MemoryDelta;
  /** Before snapshot */
  before: MemorySnapshot;
  /** After snapshot */
  after: MemorySnapshot;
  /** Timestamp */
  timestamp: number;
}

/**
 * Memory monitor configuration
 */
export interface MemoryMonitorConfig {
  /** Warning threshold in MB (default: 512) */
  warnThresholdMB?: number;
  /** Critical threshold in MB (default: 1024) */
  criticalThresholdMB?: number;
  /** Interval for periodic monitoring in ms (default: 5000) */
  monitoringIntervalMs?: number;
  /** Whether to automatically log warnings (default: true) */
  autoLog?: boolean;
  /** Label for the monitor instance */
  label?: string;
}

/**
 * Memory leak detection result
 */
export interface MemoryLeakDetection {
  /** Whether a potential leak was detected */
  leakDetected: boolean;
  /** Number of samples analyzed */
  sampleCount: number;
  /** Average memory growth per sample in MB */
  avgGrowthMB: number;
  /** Total memory growth in MB */
  totalGrowthMB: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Samples used for analysis */
  samples: MemorySnapshot[];
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<MemoryMonitorConfig> = {
  warnThresholdMB: 512,
  criticalThresholdMB: 1024,
  monitoringIntervalMs: 5000,
  autoLog: true,
  label: 'memory-monitor'
};

// ============================================================================
// Memory Snapshot Utilities
// ============================================================================

const memoryLogger = createLogger({ component: 'memory-monitor' });

/**
 * Check if browser supports performance.memory API
 */
export function isMemoryApiSupported(): boolean {
  return typeof performance !== 'undefined' &&
         'memory' in performance &&
         performance.memory !== null;
}

/**
 * Get raw browser memory information
 */
export function getBrowserMemoryInfo(): BrowserMemoryInfo {
  if (!isMemoryApiSupported()) {
    return {
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      usedJSHeapSize: 0,
      supported: false
    };
  }

  const memory = (performance as Performance & { memory?: {
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    usedJSHeapSize: number;
  }}).memory!;

  return {
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    usedJSHeapSize: memory.usedJSHeapSize,
    supported: true
  };
}

/**
 * Get current memory snapshot with formatted values
 *
 * @returns Memory snapshot with all metrics
 *
 * @example
 * ```typescript
 * const snapshot = getMemorySnapshot();
 * console.log(`Memory usage: ${snapshot.heapUsagePercent.toFixed(1)}%`);
 * console.log(`Used: ${snapshot.formattedUsedHeap}`);
 * ```
 */
export function getMemorySnapshot(): MemorySnapshot {
  const browserMemory = getBrowserMemoryInfo();

  const usedJSHeapSizeMB = browserMemory.supported
    ? Math.round((browserMemory.usedJSHeapSize / 1024 / 1024) * 100) / 100
    : 0;

  const totalJSHeapSizeMB = browserMemory.supported
    ? Math.round((browserMemory.totalJSHeapSize / 1024 / 1024) * 100) / 100
    : 0;

  const jsHeapSizeLimitMB = browserMemory.supported
    ? Math.round((browserMemory.jsHeapSizeLimit / 1024 / 1024) * 100) / 100
    : 0;

  const heapUsagePercent = browserMemory.supported && browserMemory.jsHeapSizeLimit > 0
    ? Math.round((browserMemory.usedJSHeapSize / browserMemory.jsHeapSizeLimit) * 10000) / 100
    : 0;

  return {
    browserMemory,
    usedJSHeapSizeMB,
    totalJSHeapSizeMB,
    jsHeapSizeLimitMB,
    heapUsagePercent,
    formattedUsedHeap: formatBytes(browserMemory.usedJSHeapSize),
    formattedTotalHeap: formatBytes(browserMemory.totalJSHeapSize),
    timestamp: Date.now()
  };
}

/**
 * Calculate memory delta between two snapshots
 *
 * @param before - Snapshot taken before operation
 * @param after - Snapshot taken after operation
 * @returns Memory delta information
 */
export function calculateMemoryDelta(
  before: MemorySnapshot,
  after: MemorySnapshot
): MemoryDelta {
  const deltaBytes = after.browserMemory.usedJSHeapSize - before.browserMemory.usedJSHeapSize;
  const deltaMB = Math.round((deltaBytes / 1024 / 1024) * 100) / 100;
  const increased = deltaBytes > 0;

  const percentChange = before.browserMemory.usedJSHeapSize > 0
    ? Math.round((deltaBytes / before.browserMemory.usedJSHeapSize) * 10000) / 100
    : 0;

  return {
    deltaBytes,
    deltaMB,
    formattedDelta: formatBytes(Math.abs(deltaBytes)),
    increased,
    percentChange
  };
}

// ============================================================================
// Memory Tracking
// ============================================================================

/**
 * Track memory usage and log/warn based on thresholds
 *
 * @param label - Optional label for the measurement
 * @param config - Optional configuration
 * @returns Memory snapshot
 *
 * @example
 * ```typescript
 * // Track memory at a point in time
 * const snapshot = trackMemoryUsage('after-file-load');
 *
 * // Track with custom thresholds
 * const snapshot = trackMemoryUsage('critical-operation', {
 *   warnThresholdMB: 256
 * });
 * ```
 */
export function trackMemoryUsage(
  label?: string,
  config?: Pick<MemoryMonitorConfig, 'warnThresholdMB' | 'criticalThresholdMB'>
): MemorySnapshot {
  const snapshot = getMemorySnapshot();
  const logLabel = label ?? 'memory-snapshot';
  const warnThreshold = config?.warnThresholdMB ?? DEFAULT_CONFIG.warnThresholdMB;
  const criticalThreshold = config?.criticalThresholdMB ?? DEFAULT_CONFIG.criticalThresholdMB;

  if (!snapshot.browserMemory.supported) {
    memoryLogger.debug(`Memory API not supported (label: ${logLabel})`);
    return snapshot;
  }

  const logData: LogMetadata = {
    label: logLabel,
    usedJSHeapSizeMB: snapshot.usedJSHeapSizeMB,
    totalJSHeapSizeMB: snapshot.totalJSHeapSizeMB,
    jsHeapSizeLimitMB: snapshot.jsHeapSizeLimitMB,
    heapUsagePercent: snapshot.heapUsagePercent,
    formattedUsedHeap: snapshot.formattedUsedHeap,
    formattedTotalHeap: snapshot.formattedTotalHeap
  };

  if (snapshot.usedJSHeapSizeMB >= criticalThreshold) {
    memoryLogger.error(`Critical memory usage: ${logLabel}`, logData);
  } else if (snapshot.usedJSHeapSizeMB >= warnThreshold) {
    memoryLogger.warn(`High memory usage: ${logLabel}`, logData);
  } else {
    memoryLogger.debug(`Memory snapshot: ${logLabel}`, logData);
  }

  return snapshot;
}

/**
 * Track memory delta around an operation
 *
 * Executes a function while tracking memory usage before and after,
 * logging the delta and returning the result along with metrics.
 *
 * @param operation - Name of the operation
 * @param fn - Function to execute
 * @param config - Optional configuration
 * @returns Result with memory tracking information
 *
 * @example
 * ```typescript
 * const result = await withMemoryTracking(
 *   'load-large-file',
 *   async () => {
 *     return await loadFile('large.txt');
 *   }
 * );
 *
 * console.log(`File loaded, memory delta: ${result.memoryDelta.deltaMB}MB`);
 * console.log(`Duration: ${result.durationMs}ms`);
 * ```
 */
export async function withMemoryTracking<T>(
  operation: string,
  fn: () => Promise<T> | T,
  config?: Pick<MemoryMonitorConfig, 'warnThresholdMB' | 'autoLog'>
): Promise<MemoryTrackingResult<T>> {
  const before = getMemorySnapshot();
  const startTime = performance.now();

  try {
    const result = await fn();
    const endTime = performance.now();
    const after = getMemorySnapshot();

    const durationMs = Math.round((endTime - startTime) * 100) / 100;
    const memoryDelta = calculateMemoryDelta(before, after);

    const trackingResult: MemoryTrackingResult<T> = {
      result,
      operation,
      durationMs,
      memoryDelta,
      before,
      after,
      timestamp: Date.now()
    };

    const autoLog = config?.autoLog ?? DEFAULT_CONFIG.autoLog;
    const warnThreshold = config?.warnThresholdMB ?? DEFAULT_CONFIG.warnThresholdMB;

    if (autoLog && before.browserMemory.supported) {
      const logData: LogMetadata = {
        operation,
        durationMs,
        formattedDuration: formatDuration(durationMs),
        memoryDeltaMB: memoryDelta.deltaMB,
        formattedDelta: memoryDelta.formattedDelta,
        direction: memoryDelta.increased ? 'increase' : 'decrease',
        percentChange: memoryDelta.percentChange,
        usedAfterMB: after.usedJSHeapSizeMB,
        usedBeforeMB: before.usedJSHeapSizeMB
      };

      if (Math.abs(memoryDelta.deltaMB) >= warnThreshold) {
        memoryLogger.warn(`Large memory change in ${operation}`, logData);
      } else {
        memoryLogger.debug(`Memory tracking: ${operation}`, logData);
      }
    }

    return trackingResult;
  } catch (error) {
    const endTime = performance.now();
    const after = getMemorySnapshot();
    const durationMs = Math.round((endTime - startTime) * 100) / 100;
    const memoryDelta = calculateMemoryDelta(before, after);

    memoryLogger.error(`Memory tracking failed for ${operation}`, {
      operation,
      durationMs,
      memoryDeltaMB: memoryDelta.deltaMB,
      error: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}

// ============================================================================
// Memory Monitor Class
// ============================================================================

/**
 * Continuous memory monitor for tracking memory over time
 *
 * Useful for detecting memory leaks and tracking memory patterns
 * during long-running editor operations.
 *
 * @example
 * ```typescript
 * const monitor = new MemoryMonitor({
 *   label: 'editor-session',
 *   warnThresholdMB: 512,
 *   monitoringIntervalMs: 10000
 * });
 *
 * monitor.start();
 * // ... perform editor operations ...
 * const report = monitor.stop();
 *
 * console.log(`Peak memory: ${report.peakMemoryMB}MB`);
 * console.log(`Average: ${report.avgMemoryMB}MB`);
 * ```
 */
export class MemoryMonitor {
  private readonly config: Required<MemoryMonitorConfig>;
  private readonly logger = createLogger({ component: 'memory-monitor' });
  private intervalId: number | null = null;
  private samples: MemorySnapshot[] = [];
  private startTime: number | null = null;
  private running = false;

  constructor(config?: MemoryMonitorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start monitoring memory
   */
  start(): void {
    if (this.running) {
      this.logger.warn('Memory monitor already running', { label: this.config.label });
      return;
    }

    this.running = true;
    this.startTime = Date.now();
    this.samples = [];

    // Take initial sample
    const initialSnapshot = getMemorySnapshot();
    this.samples.push(initialSnapshot);

    if (!initialSnapshot.browserMemory.supported) {
      this.logger.debug('Memory API not supported, monitoring disabled', {
        label: this.config.label
      });
      return;
    }

    // Start periodic sampling
    this.intervalId = window.setInterval(() => {
      this.takeSample();
    }, this.config.monitoringIntervalMs);

    this.logger.debug(`Memory monitoring started: ${this.config.label}`, {
      label: this.config.label,
      intervalMs: this.config.monitoringIntervalMs,
      initialMemoryMB: initialSnapshot.usedJSHeapSizeMB
    });
  }

  /**
   * Stop monitoring and generate report
   */
  stop(): MemoryMonitorReport {
    if (!this.running) {
      this.logger.warn('Memory monitor not running', { label: this.config.label });
      return this.generateReport();
    }

    this.running = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Take final sample
    this.takeSample();

    const report = this.generateReport();

    this.logger.info(`Memory monitoring stopped: ${this.config.label}`, {
      label: this.config.label,
      durationMs: report.durationMs,
      sampleCount: report.sampleCount,
      peakMemoryMB: report.peakMemoryMB,
      avgMemoryMB: report.avgMemoryMB,
      memoryGrowthMB: report.memoryGrowthMB
    });

    return report;
  }

  /**
   * Check if monitoring is active
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get current samples
   */
  getSamples(): MemorySnapshot[] {
    return [...this.samples];
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeak(): MemoryLeakDetection {
    if (this.samples.length < 3) {
      return {
        leakDetected: false,
        sampleCount: this.samples.length,
        avgGrowthMB: 0,
        totalGrowthMB: 0,
        confidence: 0,
        samples: this.samples
      };
    }

    // Calculate memory growth between samples
    const growthRates: number[] = [];
    for (let i = 1; i < this.samples.length; i++) {
      const delta = this.samples[i].usedJSHeapSizeMB - this.samples[i - 1].usedJSHeapSizeMB;
      growthRates.push(delta);
    }

    const avgGrowthMB = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
    const totalGrowthMB = this.samples[this.samples.length - 1].usedJSHeapSizeMB -
                          this.samples[0].usedJSHeapSizeMB;

    // Leak detection heuristics:
    // 1. Consistent positive growth
    const positiveGrowthCount = growthRates.filter(rate => rate > 0).length;
    const consistentGrowth = positiveGrowthCount / growthRates.length > 0.7;

    // 2. Significant total growth (> 50MB)
    const significantGrowth = totalGrowthMB > 50;

    // 3. Average growth rate > 5MB per sample
    const sustainedGrowth = avgGrowthMB > 5;

    // Calculate confidence
    let confidence = 0;
    if (consistentGrowth) confidence += 0.4;
    if (significantGrowth) confidence += 0.3;
    if (sustainedGrowth) confidence += 0.3;

    const leakDetected = confidence >= 0.6;

    if (leakDetected && this.config.autoLog) {
      this.logger.warn('Potential memory leak detected', {
        label: this.config.label,
        avgGrowthMB,
        totalGrowthMB,
        confidence,
        sampleCount: this.samples.length
      });
    }

    return {
      leakDetected,
      sampleCount: this.samples.length,
      avgGrowthMB: Math.round(avgGrowthMB * 100) / 100,
      totalGrowthMB: Math.round(totalGrowthMB * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      samples: this.samples
    };
  }

  /**
   * Take a memory sample
   */
  private takeSample(): void {
    const snapshot = getMemorySnapshot();
    this.samples.push(snapshot);

    // Check thresholds
    if (this.config.autoLog && snapshot.browserMemory.supported) {
      if (snapshot.usedJSHeapSizeMB >= this.config.criticalThresholdMB) {
        this.logger.error('Critical memory threshold exceeded', {
          label: this.config.label,
          usedJSHeapSizeMB: snapshot.usedJSHeapSizeMB,
          threshold: this.config.criticalThresholdMB
        });
      } else if (snapshot.usedJSHeapSizeMB >= this.config.warnThresholdMB) {
        this.logger.warn('Memory warning threshold exceeded', {
          label: this.config.label,
          usedJSHeapSizeMB: snapshot.usedJSHeapSizeMB,
          threshold: this.config.warnThresholdMB
        });
      }
    }
  }

  /**
   * Generate monitoring report
   */
  private generateReport(): MemoryMonitorReport {
    const durationMs = this.startTime !== null
      ? Date.now() - this.startTime
      : 0;

    if (this.samples.length === 0) {
      return {
        label: this.config.label,
        durationMs,
        formattedDuration: formatDuration(durationMs),
        sampleCount: 0,
        peakMemoryMB: 0,
        minMemoryMB: 0,
        avgMemoryMB: 0,
        memoryGrowthMB: 0,
        samples: []
      };
    }

    const memoryValues = this.samples.map(s => s.usedJSHeapSizeMB);
    const peakMemoryMB = Math.max(...memoryValues);
    const minMemoryMB = Math.min(...memoryValues);
    const avgMemoryMB = Math.round(
      (memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length) * 100
    ) / 100;
    const memoryGrowthMB = this.samples[this.samples.length - 1].usedJSHeapSizeMB -
                           this.samples[0].usedJSHeapSizeMB;

    return {
      label: this.config.label,
      durationMs,
      formattedDuration: formatDuration(durationMs),
      sampleCount: this.samples.length,
      peakMemoryMB: Math.round(peakMemoryMB * 100) / 100,
      minMemoryMB: Math.round(minMemoryMB * 100) / 100,
      avgMemoryMB,
      memoryGrowthMB: Math.round(memoryGrowthMB * 100) / 100,
      samples: this.samples
    };
  }
}

/**
 * Memory monitor report
 */
export interface MemoryMonitorReport {
  /** Monitor label */
  label: string;
  /** Total monitoring duration in ms */
  durationMs: number;
  /** Formatted duration string */
  formattedDuration: string;
  /** Number of samples collected */
  sampleCount: number;
  /** Peak memory usage in MB */
  peakMemoryMB: number;
  /** Minimum memory usage in MB */
  minMemoryMB: number;
  /** Average memory usage in MB */
  avgMemoryMB: number;
  /** Total memory growth in MB */
  memoryGrowthMB: number;
  /** All collected samples */
  samples: MemorySnapshot[];
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Force garbage collection if available (Chrome with --expose-gc flag)
 *
 * Note: This requires Chrome to be run with --expose-gc flag
 */
export function forceGarbageCollection(): void {
  if (typeof global !== 'undefined' && 'gc' in global && typeof (global as { gc?: () => void }).gc === 'function') {
    (global as { gc: () => void }).gc();
    memoryLogger.debug('Forced garbage collection');
  } else {
    memoryLogger.debug('Garbage collection not available (requires --expose-gc flag)');
  }
}

/**
 * Get memory pressure estimate (0-1 scale)
 *
 * Returns an estimate of memory pressure based on heap usage percentage
 */
export function getMemoryPressure(): number {
  const snapshot = getMemorySnapshot();

  if (!snapshot.browserMemory.supported) {
    return 0;
  }

  // Convert percentage to 0-1 scale
  return Math.min(1, snapshot.heapUsagePercent / 100);
}
