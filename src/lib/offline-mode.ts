/**
 * Offline Mode Detection and Monitoring
 *
 * This module provides robust offline detection for air-gapped and network-restricted
 * environments with:
 * - Browser-based detection via navigator.onLine API
 * - Server-side detection via periodic health checks
 * - Configurable health check endpoints for custom connectivity verification
 * - Event-based status change notifications
 * - Metrics and monitoring support
 *
 * @example
 * ```typescript
 * // Browser usage
 * const detector = new OfflineDetector({
 *   healthCheckInterval: 30000,
 *   healthCheckEndpoints: ['https://api.example.com/health'],
 * });
 *
 * detector.on('statusChange', ({ online, previouslyOnline }) => {
 *   console.log(`Network status: ${online ? 'Online' : 'Offline'}`);
 * });
 *
 * await detector.start();
 *
 * // Check current status
 * const isOnline = detector.isOnline();
 * const metrics = detector.getMetrics();
 * ```
 */

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Network connectivity status
 */
export enum NetworkStatus {
  /** Online - network connectivity detected */
  ONLINE = 'ONLINE',
  /** Offline - no network connectivity */
  OFFLINE = 'OFFLINE',
  /** Checking - currently performing health check */
  CHECKING = 'CHECKING',
  /** Unknown - status not yet determined */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Configuration options for offline detector
 */
export interface OfflineDetectorOptions {
  /** Interval in ms for periodic health checks (default: 30000) */
  healthCheckInterval: number;
  /** Array of endpoints to check for connectivity (default: []) */
  healthCheckEndpoints: string[];
  /** Timeout in ms for health check requests (default: 5000) */
  healthCheckTimeout: number;
  /** Number of consecutive failures before marking offline (default: 2) */
  failureThreshold: number;
  /** Number of consecutive successes before marking online (default: 1) */
  successThreshold: number;
  /** Enable browser navigator.onLine detection (default: true) */
  useBrowserAPI: boolean;
  /** Enable periodic health checks (default: true) */
  useHealthChecks: boolean;
  /** Custom function to perform health check */
  customHealthCheck?: () => Promise<boolean>;
  /** Called when network status changes */
  onStatusChange?: (event: StatusChangeEvent) => void;
  /** Called when health check completes */
  onHealthCheck?: (result: HealthCheckResult) => void;
  /** Enable debug logging (default: false) */
  debug: boolean;
}

/**
 * Status change event
 */
export interface StatusChangeEvent {
  /** Current online status */
  online: boolean;
  /** Previous online status */
  previouslyOnline: boolean;
  /** Timestamp of status change */
  timestamp: number;
  /** Reason for status change */
  reason: StatusChangeReason;
  /** Additional context about the change */
  context?: Record<string, unknown>;
}

/**
 * Reasons for status change
 */
export enum StatusChangeReason {
  /** Browser API reported change */
  BROWSER_EVENT = 'BROWSER_EVENT',
  /** Health check detected change */
  HEALTH_CHECK = 'HEALTH_CHECK',
  /** Manual status override */
  MANUAL = 'MANUAL',
  /** Initial detection */
  INITIALIZATION = 'INITIALIZATION',
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Whether the check succeeded */
  success: boolean;
  /** Duration of the check in ms */
  duration: number;
  /** Timestamp of the check */
  timestamp: number;
  /** Endpoint that was checked (if applicable) */
  endpoint?: string;
  /** Error message if check failed */
  error?: string;
}

/**
 * Offline detector metrics
 */
export interface OfflineDetectorMetrics {
  /** Current network status */
  status: NetworkStatus;
  /** Whether currently online */
  isOnline: boolean;
  /** Total number of health checks performed */
  totalHealthChecks: number;
  /** Number of successful health checks */
  successfulHealthChecks: number;
  /** Number of failed health checks */
  failedHealthChecks: number;
  /** Consecutive failure count */
  consecutiveFailures: number;
  /** Consecutive success count */
  consecutiveSuccesses: number;
  /** Last successful health check timestamp */
  lastSuccessTime: number | null;
  /** Last failed health check timestamp */
  lastFailureTime: number | null;
  /** Last status change timestamp */
  lastStatusChangeTime: number | null;
  /** Total number of status changes */
  totalStatusChanges: number;
  /** Average health check duration in ms */
  avgHealthCheckDuration: number;
  /** Uptime percentage (0-100) */
  uptimePercentage: number;
  /** Time spent online in ms */
  timeOnline: number;
  /** Time spent offline in ms */
  timeOffline: number;
}

/**
 * Event listener callback type
 */
type EventCallback<T = unknown> = (data: T) => void;

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown when health check fails
 */
export class HealthCheckError extends Error {
  public readonly endpoint?: string;
  public readonly statusCode?: number;

  constructor(message: string, endpoint?: string, statusCode?: number) {
    super(message);
    this.name = 'HealthCheckError';
    this.endpoint = endpoint;
    this.statusCode = statusCode;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HealthCheckError);
    }
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if running in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

/**
 * Perform HTTP health check
 */
async function performHttpHealthCheck(
  endpoint: string,
  timeout: number,
  signal?: AbortSignal
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Combine user signal with timeout signal
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const response = await fetch(endpoint, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    const success = response.ok;
    const duration = Date.now() - startTime;

    return {
      success,
      duration,
      timestamp: Date.now(),
      endpoint,
      error: success ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      duration,
      timestamp: Date.now(),
      endpoint,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Offline Detector Class
// =============================================================================

/**
 * Offline detector with network monitoring and health checks
 *
 * Supports both browser-based detection (navigator.onLine) and server-side
 * detection via periodic health checks to configurable endpoints.
 */
export class OfflineDetector {
  private options: Required<Omit<OfflineDetectorOptions, 'customHealthCheck' | 'onStatusChange' | 'onHealthCheck'>> & {
    customHealthCheck?: () => Promise<boolean>;
    onStatusChange?: (event: StatusChangeEvent) => void;
    onHealthCheck?: (result: HealthCheckResult) => void;
  };
  private status: NetworkStatus = NetworkStatus.UNKNOWN;
  private isRunning = false;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private abortController: AbortController | null = null;

  // Event listeners
  private eventListeners: Map<string, EventCallback[]> = new Map();

  // Metrics
  private metrics = {
    totalHealthChecks: 0,
    successfulHealthChecks: 0,
    failedHealthChecks: 0,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    lastSuccessTime: null as number | null,
    lastFailureTime: null as number | null,
    lastStatusChangeTime: null as number | null,
    totalStatusChanges: 0,
    healthCheckDurations: [] as number[],
    onlineSince: null as number | null,
    offlineSince: null as number | null,
    totalTimeOnline: 0,
    totalTimeOffline: 0,
  };

  constructor(options: Partial<OfflineDetectorOptions> = {}) {
    this.options = {
      healthCheckInterval: options.healthCheckInterval ?? 30000,
      healthCheckEndpoints: options.healthCheckEndpoints ?? [],
      healthCheckTimeout: options.healthCheckTimeout ?? 5000,
      failureThreshold: options.failureThreshold ?? 2,
      successThreshold: options.successThreshold ?? 1,
      useBrowserAPI: options.useBrowserAPI ?? true,
      useHealthChecks: options.useHealthChecks ?? true,
      debug: options.debug ?? false,
      customHealthCheck: options.customHealthCheck,
      onStatusChange: options.onStatusChange,
      onHealthCheck: options.onHealthCheck,
    };

    // Register callback if provided
    if (this.options.onStatusChange) {
      this.on('statusChange', this.options.onStatusChange);
    }
    if (this.options.onHealthCheck) {
      this.on('healthCheck', this.options.onHealthCheck);
    }
  }

  /**
   * Start offline detection
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.debug('Detector already running');
      return;
    }

    this.isRunning = true;
    this.abortController = new AbortController();

    // Perform initial detection
    await this.performInitialDetection();

    // Set up browser event listeners
    if (isBrowser() && this.options.useBrowserAPI) {
      this.setupBrowserListeners();
    }

    // Start periodic health checks
    if (this.options.useHealthChecks) {
      this.startHealthChecks();
    }

    this.debug('Detector started');
  }

  /**
   * Stop offline detection
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear health check timer
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Abort any in-flight requests
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Remove browser event listeners
    if (isBrowser() && this.options.useBrowserAPI) {
      this.removeBrowserListeners();
    }

    // Update time tracking
    this.updateTimeTracking();

    this.debug('Detector stopped');
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.status === NetworkStatus.ONLINE;
  }

  /**
   * Get current network status
   */
  getStatus(): NetworkStatus {
    return this.status;
  }

  /**
   * Get detector metrics
   */
  getMetrics(): OfflineDetectorMetrics {
    this.updateTimeTracking();

    const avgDuration =
      this.metrics.healthCheckDurations.length > 0
        ? this.metrics.healthCheckDurations.reduce((a, b) => a + b, 0) / this.metrics.healthCheckDurations.length
        : 0;

    const totalTime = this.metrics.totalTimeOnline + this.metrics.totalTimeOffline;
    const uptimePercentage = totalTime > 0 ? (this.metrics.totalTimeOnline / totalTime) * 100 : 0;

    return {
      status: this.status,
      isOnline: this.isOnline(),
      totalHealthChecks: this.metrics.totalHealthChecks,
      successfulHealthChecks: this.metrics.successfulHealthChecks,
      failedHealthChecks: this.metrics.failedHealthChecks,
      consecutiveFailures: this.metrics.consecutiveFailures,
      consecutiveSuccesses: this.metrics.consecutiveSuccesses,
      lastSuccessTime: this.metrics.lastSuccessTime,
      lastFailureTime: this.metrics.lastFailureTime,
      lastStatusChangeTime: this.metrics.lastStatusChangeTime,
      totalStatusChanges: this.metrics.totalStatusChanges,
      avgHealthCheckDuration: avgDuration,
      uptimePercentage,
      timeOnline: this.metrics.totalTimeOnline,
      timeOffline: this.metrics.totalTimeOffline,
    };
  }

  /**
   * Manually trigger a health check
   */
  async checkNow(): Promise<boolean> {
    return await this.performHealthCheck();
  }

  /**
   * Register event listener
   */
  on<T = unknown>(event: string, callback: EventCallback<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback as EventCallback);
  }

  /**
   * Unregister event listener
   */
  off<T = unknown>(event: string, callback: EventCallback<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback as EventCallback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit<T>(event: string, data: T): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Perform initial detection
   */
  private async performInitialDetection(): Promise<void> {
    let initialStatus = NetworkStatus.UNKNOWN;

    // Check browser API first
    if (isBrowser() && this.options.useBrowserAPI && navigator.onLine !== undefined) {
      initialStatus = navigator.onLine ? NetworkStatus.ONLINE : NetworkStatus.OFFLINE;
    }

    // Perform health check if enabled
    if (this.options.useHealthChecks) {
      const isHealthy = await this.performHealthCheck();
      initialStatus = isHealthy ? NetworkStatus.ONLINE : NetworkStatus.OFFLINE;
    }

    // Default to online if no detection method available
    if (initialStatus === NetworkStatus.UNKNOWN) {
      initialStatus = NetworkStatus.ONLINE;
    }

    this.setStatus(initialStatus, StatusChangeReason.INITIALIZATION);
  }

  /**
   * Setup browser event listeners
   */
  private setupBrowserListeners(): void {
    window.addEventListener('online', this.handleOnlineEvent);
    window.addEventListener('offline', this.handleOfflineEvent);
  }

  /**
   * Remove browser event listeners
   */
  private removeBrowserListeners(): void {
    window.removeEventListener('online', this.handleOnlineEvent);
    window.removeEventListener('offline', this.handleOfflineEvent);
  }

  /**
   * Handle browser online event
   */
  private handleOnlineEvent = (): void => {
    this.debug('Browser online event');
    this.setStatus(NetworkStatus.ONLINE, StatusChangeReason.BROWSER_EVENT);
  };

  /**
   * Handle browser offline event
   */
  private handleOfflineEvent = (): void => {
    this.debug('Browser offline event');
    this.setStatus(NetworkStatus.OFFLINE, StatusChangeReason.BROWSER_EVENT);
  };

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck().catch((error) => {
        console.error('Health check error:', error);
      });
    }, this.options.healthCheckInterval);
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<boolean> {
    this.status = NetworkStatus.CHECKING;
    this.metrics.totalHealthChecks++;

    let result: HealthCheckResult;

    try {
      // Use custom health check if provided
      if (this.options.customHealthCheck) {
        const startTime = Date.now();
        const success = await this.options.customHealthCheck();
        const duration = Date.now() - startTime;

        result = {
          success,
          duration,
          timestamp: Date.now(),
        };
      }
      // Otherwise check configured endpoints
      else if (this.options.healthCheckEndpoints.length > 0) {
        // Check first endpoint (can be enhanced to check multiple)
        const endpoint = this.options.healthCheckEndpoints[0];
        result = await performHttpHealthCheck(
          endpoint,
          this.options.healthCheckTimeout,
          this.abortController?.signal
        );
      }
      // No health check method available
      else {
        result = {
          success: true,
          duration: 0,
          timestamp: Date.now(),
        };
      }

      // Update metrics
      this.metrics.healthCheckDurations.push(result.duration);
      if (this.metrics.healthCheckDurations.length > 100) {
        this.metrics.healthCheckDurations.shift();
      }

      if (result.success) {
        this.metrics.successfulHealthChecks++;
        this.metrics.consecutiveSuccesses++;
        this.metrics.consecutiveFailures = 0;
        this.metrics.lastSuccessTime = result.timestamp;

        // Update status if threshold met
        if (this.metrics.consecutiveSuccesses >= this.options.successThreshold) {
          this.setStatus(NetworkStatus.ONLINE, StatusChangeReason.HEALTH_CHECK);
        }
      } else {
        this.metrics.failedHealthChecks++;
        this.metrics.consecutiveFailures++;
        this.metrics.consecutiveSuccesses = 0;
        this.metrics.lastFailureTime = result.timestamp;

        // Update status if threshold met
        if (this.metrics.consecutiveFailures >= this.options.failureThreshold) {
          this.setStatus(NetworkStatus.OFFLINE, StatusChangeReason.HEALTH_CHECK);
        }
      }

      // Emit health check result
      this.emit('healthCheck', result);

      return result.success;
    } catch (error) {
      // Handle unexpected errors
      this.metrics.failedHealthChecks++;
      this.metrics.consecutiveFailures++;
      this.metrics.consecutiveSuccesses = 0;

      result = {
        success: false,
        duration: 0,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      this.emit('healthCheck', result);

      if (this.metrics.consecutiveFailures >= this.options.failureThreshold) {
        this.setStatus(NetworkStatus.OFFLINE, StatusChangeReason.HEALTH_CHECK);
      }

      return false;
    }
  }

  /**
   * Set network status and emit change event
   */
  private setStatus(newStatus: NetworkStatus, reason: StatusChangeReason, context?: Record<string, unknown>): void {
    const previousStatus = this.status;

    // Skip if status hasn't changed (unless it's CHECKING)
    if (previousStatus === newStatus && newStatus !== NetworkStatus.CHECKING) {
      return;
    }

    this.updateTimeTracking();

    this.status = newStatus;
    this.metrics.lastStatusChangeTime = Date.now();

    // Start tracking time for new status
    if (newStatus === NetworkStatus.ONLINE) {
      this.metrics.onlineSince = Date.now();
      this.metrics.offlineSince = null;
    } else if (newStatus === NetworkStatus.OFFLINE) {
      this.metrics.offlineSince = Date.now();
      this.metrics.onlineSince = null;
    }

    // Only count actual status changes (not CHECKING)
    if (newStatus !== NetworkStatus.CHECKING && previousStatus !== NetworkStatus.CHECKING) {
      this.metrics.totalStatusChanges++;

      const event: StatusChangeEvent = {
        online: newStatus === NetworkStatus.ONLINE,
        previouslyOnline: previousStatus === NetworkStatus.ONLINE,
        timestamp: Date.now(),
        reason,
        context,
      };

      this.emit('statusChange', event);

      this.debug(
        `Status changed: ${previousStatus} → ${newStatus} (reason: ${reason})`,
        context
      );
    }
  }

  /**
   * Update time tracking metrics
   */
  private updateTimeTracking(): void {
    const now = Date.now();

    if (this.metrics.onlineSince !== null) {
      this.metrics.totalTimeOnline += now - this.metrics.onlineSince;
      this.metrics.onlineSince = now;
    }

    if (this.metrics.offlineSince !== null) {
      this.metrics.totalTimeOffline += now - this.metrics.offlineSince;
      this.metrics.offlineSince = now;
    }
  }

  /**
   * Debug logging
   */
  private debug(message: string, ...args: unknown[]): void {
    if (this.options.debug) {
      console.log(`[OfflineDetector] ${message}`, ...args);
    }
  }
}

// =============================================================================
// Singleton Instance (Optional Convenience)
// =============================================================================

let defaultInstance: OfflineDetector | null = null;

/**
 * Get or create the default offline detector instance
 */
export function getDefaultOfflineDetector(
  options?: Partial<OfflineDetectorOptions>
): OfflineDetector {
  if (!defaultInstance) {
    defaultInstance = new OfflineDetector(options);
  }
  return defaultInstance;
}

/**
 * Reset the default instance (useful for testing)
 */
export function resetDefaultOfflineDetector(): void {
  if (defaultInstance) {
    defaultInstance.stop();
    defaultInstance = null;
  }
}
