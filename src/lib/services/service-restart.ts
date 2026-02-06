/**
 * Service Restart Manager
 *
 * Manages restart operations for the 5-service stack in Alpine Linux VM:
 * - SSH (Dropbear) - port 2222
 * - PostgreSQL - port 5432
 * - Valkey/Redis - port 6379
 * - OpenVSCode - port 3000
 * - Docker - port 2375
 *
 * Features:
 * - Execute restart commands via SSH to VM
 * - Track restart status and history
 * - Post-restart health verification
 * - Datadog APM tracing
 */

import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import tracer from 'dd-trace';
import type { Span } from 'dd-trace';
import { metrics } from '@/lib/server-monitoring';
import { unifiedHealthService, invalidateHealthCache } from '@/lib/health/unified-health-service';
import type { ServiceName, ServiceHealthStatus } from '@/types/health';
import type {
  RestartRequest,
  RestartResult,
  RestartStatus,
  RestartHistoryEntry,
  RestartHistory,
  ServiceRestartConfig,
  RestartOperationStatus,
  AggregatedRestartStatus,
  RestartEvent,
  RestartSpanTags,
} from '@/types/service-restart';

const execFileAsync = promisify(execFile);

/**
 * Default configuration values
 */
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_HEALTH_CHECK_DELAY_MS = 2000;
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 10000;
const DEFAULT_MAX_HEALTH_RETRIES = 3;
const DEFAULT_HEALTH_RETRY_DELAY_MS = 2000;
const MAX_HISTORY_ENTRIES = 100;

/**
 * SSH configuration for VM access
 */
const getSSHConfig = () => ({
  host: process.env.VM_SSH_HOST || process.env.SSH_HOST || 'localhost',
  port: parseInt(process.env.VM_SSH_PORT || process.env.SSH_PORT || '2222', 10),
  user: process.env.VM_SSH_USER || 'root',
  keyPath: process.env.VM_SSH_KEY_PATH || '~/.ssh/id_rsa',
  strictHostKeyChecking: process.env.VM_SSH_STRICT_HOST_KEY !== 'true',
});

/**
 * Service restart configurations
 * Commands are hardcoded for security - no user input in command strings
 */
const SERVICE_CONFIGS: Record<ServiceName, ServiceRestartConfig> = {
  ssh: {
    serviceName: 'ssh',
    restartCommand: 'rc-service dropbear restart',
    healthCheckDelayMs: 3000, // SSH needs more time after restart
    healthCheckTimeoutMs: 15000,
    canRestart: true,
    // Note: Restarting SSH while connected via SSH is risky
  },
  postgresql: {
    serviceName: 'postgresql',
    restartCommand: 'rc-service postgresql restart',
    healthCheckDelayMs: 5000, // PostgreSQL needs time to initialize
    healthCheckTimeoutMs: 20000,
    canRestart: true,
  },
  valkey: {
    serviceName: 'valkey',
    restartCommand: 'rc-service valkey restart',
    healthCheckDelayMs: 2000,
    healthCheckTimeoutMs: 10000,
    canRestart: true,
  },
  openvscode: {
    serviceName: 'openvscode',
    restartCommand: 'rc-service openvscode restart',
    healthCheckDelayMs: 3000,
    healthCheckTimeoutMs: 15000,
    canRestart: true,
  },
  docker: {
    serviceName: 'docker',
    restartCommand: 'rc-service docker restart',
    healthCheckDelayMs: 5000, // Docker daemon needs time to start
    healthCheckTimeoutMs: 30000,
    canRestart: true,
  },
};

/**
 * Event listeners for restart events
 */
type RestartEventListener = (event: RestartEvent) => void;

/**
 * ServiceRestartManager class
 *
 * Provides methods to restart services in the Alpine Linux VM and track
 * restart history with health verification.
 */
export class ServiceRestartManager {
  private restartHistory: RestartHistory = [];
  private currentOperation: RestartOperationStatus | null = null;
  private eventListeners: Set<RestartEventListener> = new Set();
  private lastResults: Map<ServiceName, RestartResult> = new Map();

  /**
   * Restart a single service
   *
   * @param request - The restart request configuration
   * @returns Promise resolving to the restart result
   *
   * @example
   * ```typescript
   * const manager = new ServiceRestartManager();
   * const result = await manager.restartService({
   *   serviceName: 'postgresql',
   *   verifyHealth: true,
   *   requestedBy: 'admin@example.com'
   * });
   * ```
   */
  async restartService(request: RestartRequest): Promise<RestartResult> {
    const { serviceName, force = false, verifyHealth = true, requestedBy } = request;
    const timeoutMs = request.timeoutMs || DEFAULT_TIMEOUT_MS;
    const maxHealthRetries = request.maxHealthRetries || DEFAULT_MAX_HEALTH_RETRIES;
    const healthRetryDelayMs = request.healthRetryDelayMs || DEFAULT_HEALTH_RETRY_DELAY_MS;

    const config = SERVICE_CONFIGS[serviceName];
    if (!config) {
      return this.createErrorResult(serviceName, `Unknown service: ${serviceName}`);
    }

    if (!config.canRestart) {
      return this.createErrorResult(serviceName, `Service ${serviceName} cannot be restarted`);
    }

    // Check if another restart is in progress
    if (this.currentOperation?.inProgress) {
      return this.createErrorResult(
        serviceName,
        `Another restart operation is in progress for ${this.currentOperation.serviceName}`
      );
    }

    const operationId = randomUUID();
    const startTime = Date.now();
    const startedAt = new Date().toISOString();

    // Start Datadog trace
    const span = this.startRestartSpan(serviceName);

    // Set current operation
    this.currentOperation = {
      inProgress: true,
      serviceName,
      status: 'pending',
      startedAt,
    };

    // Emit started event
    this.emitEvent({
      type: 'restart:started',
      serviceName,
      status: 'pending',
      progress: 0,
      timestamp: startedAt,
    });

    let result: RestartResult;

    try {
      // Update status to restarting
      this.updateOperationStatus('restarting');
      this.emitEvent({
        type: 'restart:progress',
        serviceName,
        status: 'restarting',
        progress: 25,
        data: { message: `Executing restart command for ${serviceName}` },
        timestamp: new Date().toISOString(),
      });

      // Execute restart command via SSH
      const execResult = await this.executeSSHCommand(config.restartCommand, timeoutMs);

      if (execResult.exitCode !== 0 && !force) {
        result = {
          serviceName,
          success: false,
          status: 'failed',
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          error: `Restart command failed with exit code ${execResult.exitCode}`,
          stdout: execResult.stdout,
          stderr: execResult.stderr,
          exitCode: execResult.exitCode,
        };
      } else {
        // Wait for service to stabilize
        this.updateOperationStatus('verifying');
        this.emitEvent({
          type: 'restart:progress',
          serviceName,
          status: 'verifying',
          progress: 50,
          data: { message: `Waiting for ${serviceName} to stabilize` },
          timestamp: new Date().toISOString(),
        });

        await this.sleep(config.healthCheckDelayMs);

        // Verify health if requested
        let healthStatus: ServiceHealthStatus = 'unknown';
        if (verifyHealth) {
          this.emitEvent({
            type: 'restart:progress',
            serviceName,
            status: 'verifying',
            progress: 75,
            data: { message: `Verifying health of ${serviceName}` },
            timestamp: new Date().toISOString(),
          });

          healthStatus = await this.verifyServiceHealth(
            serviceName,
            config.healthCheckTimeoutMs,
            maxHealthRetries,
            healthRetryDelayMs
          );
        }

        // Invalidate health cache to get fresh results
        invalidateHealthCache();

        const success = !verifyHealth || healthStatus === 'healthy';
        result = {
          serviceName,
          success,
          status: success ? 'completed' : 'failed',
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          healthStatus: verifyHealth ? healthStatus : undefined,
          stdout: execResult.stdout,
          stderr: execResult.stderr,
          exitCode: execResult.exitCode,
          error: success ? undefined : `Service failed health check after restart`,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result = {
        serviceName,
        success: false,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        error: errorMsg,
      };
    }

    // Clear current operation
    this.currentOperation = null;

    // Store result
    this.lastResults.set(serviceName, result);

    // Add to history
    this.addToHistory({
      id: operationId,
      serviceName,
      result,
      requestedBy,
      timestamp: startedAt,
      request,
    });

    // Track metrics
    this.trackRestartMetrics(result);

    // Finish Datadog span
    this.finishRestartSpan(span, result);

    // Emit completion event
    this.emitEvent({
      type: result.success ? 'restart:completed' : 'restart:failed',
      serviceName,
      status: result.status,
      progress: 100,
      data: {
        message: result.success
          ? `Successfully restarted ${serviceName}`
          : `Failed to restart ${serviceName}`,
        error: result.error,
        healthStatus: result.healthStatus,
        durationMs: result.durationMs,
      },
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /**
   * Restart all services in the stack
   *
   * @param options - Options for the restart operation
   * @returns Promise resolving to results for all services
   *
   * @example
   * ```typescript
   * const manager = new ServiceRestartManager();
   * const results = await manager.restartAll({
   *   verifyHealth: true,
   *   sequential: true
   * });
   * ```
   */
  async restartAll(options: {
    verifyHealth?: boolean;
    sequential?: boolean;
    requestedBy?: string;
    skipServices?: ServiceName[];
  } = {}): Promise<Map<ServiceName, RestartResult>> {
    const {
      verifyHealth = true,
      sequential = true,
      requestedBy,
      skipServices = [],
    } = options;

    const results = new Map<ServiceName, RestartResult>();
    const services: ServiceName[] = ['ssh', 'postgresql', 'valkey', 'openvscode', 'docker'];
    const servicesToRestart = services.filter((s) => !skipServices.includes(s));

    if (sequential) {
      // Restart services one at a time
      for (const serviceName of servicesToRestart) {
        const result = await this.restartService({
          serviceName,
          verifyHealth,
          requestedBy,
        });
        results.set(serviceName, result);

        // Stop if a critical service fails
        if (!result.success && (serviceName === 'ssh' || serviceName === 'postgresql')) {
          break;
        }
      }
    } else {
      // Restart services in parallel (use with caution)
      const restartPromises = servicesToRestart.map(async (serviceName) => {
        const result = await this.restartService({
          serviceName,
          verifyHealth,
          requestedBy,
        });
        return { serviceName, result };
      });

      const restartResults = await Promise.all(restartPromises);
      for (const { serviceName, result } of restartResults) {
        results.set(serviceName, result);
      }
    }

    return results;
  }

  /**
   * Get the current restart operation status
   *
   * @returns Current operation status or null if no operation in progress
   */
  getRestartStatus(): RestartOperationStatus | null {
    return this.currentOperation;
  }

  /**
   * Get aggregated restart status for all services
   *
   * @returns Aggregated status including current operation and last results
   */
  getAggregatedStatus(): AggregatedRestartStatus {
    const services: Record<ServiceName, RestartResult | null> = {
      ssh: this.lastResults.get('ssh') || null,
      postgresql: this.lastResults.get('postgresql') || null,
      valkey: this.lastResults.get('valkey') || null,
      openvscode: this.lastResults.get('openvscode') || null,
      docker: this.lastResults.get('docker') || null,
    };

    return {
      currentOperation: this.currentOperation || undefined,
      services,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get restart history
   *
   * @param options - Filter options
   * @returns Filtered restart history
   */
  getRestartHistory(options: {
    serviceName?: ServiceName;
    limit?: number;
    since?: string;
  } = {}): RestartHistory {
    const { serviceName, limit = 50, since } = options;

    let history = [...this.restartHistory];

    if (serviceName) {
      history = history.filter((entry) => entry.serviceName === serviceName);
    }

    if (since) {
      const sinceDate = new Date(since).getTime();
      history = history.filter((entry) => new Date(entry.timestamp).getTime() >= sinceDate);
    }

    // Sort by timestamp descending (most recent first)
    history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return history.slice(0, limit);
  }

  /**
   * Subscribe to restart events
   *
   * @param listener - Callback function for events
   * @returns Unsubscribe function
   */
  onRestartEvent(listener: RestartEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  /**
   * Execute a command via SSH to the VM
   *
   * Uses execFile instead of exec to prevent shell injection.
   * The command is passed as a single argument to SSH, which executes it on the remote host.
   */
  private async executeSSHCommand(
    command: string,
    timeoutMs: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const sshConfig = getSSHConfig();

    // Build SSH arguments array - using execFile prevents shell injection
    // The command is passed as a single string argument to SSH
    const sshArgs = [
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=10',
      '-o', `StrictHostKeyChecking=${sshConfig.strictHostKeyChecking ? 'yes' : 'no'}`,
      '-o', 'UserKnownHostsFile=/dev/null',
      '-i', sshConfig.keyPath,
      '-p', sshConfig.port.toString(),
      `${sshConfig.user}@${sshConfig.host}`,
      command, // Command is from hardcoded SERVICE_CONFIGS, not user input
    ];

    try {
      const { stdout, stderr } = await execFileAsync('ssh', sshArgs, {
        timeout: timeoutMs,
        encoding: 'utf-8',
      });

      return { stdout: stdout || '', stderr: stderr || '', exitCode: 0 };
    } catch (error: unknown) {
      // execFile throws on non-zero exit code
      if (error && typeof error === 'object') {
        const execError = error as {
          code?: number | string;
          stdout?: string;
          stderr?: string;
          message?: string;
        };
        const exitCode = typeof execError.code === 'number' ? execError.code : 1;
        return {
          stdout: execError.stdout || '',
          stderr: execError.stderr || execError.message || '',
          exitCode,
        };
      }
      throw error;
    }
  }

  /**
   * Verify service health with retries
   */
  private async verifyServiceHealth(
    serviceName: ServiceName,
    timeoutMs: number,
    maxRetries: number,
    retryDelayMs: number
  ): Promise<ServiceHealthStatus> {
    const startTime = Date.now();
    let lastStatus: ServiceHealthStatus = 'unknown';

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (Date.now() - startTime > timeoutMs) {
        break;
      }

      try {
        const result = await unifiedHealthService.getServiceHealth(serviceName);
        lastStatus = result.status;

        if (result.status === 'healthy') {
          return 'healthy';
        }
      } catch {
        // Health check failed, will retry
      }

      if (attempt < maxRetries - 1) {
        await this.sleep(retryDelayMs);
      }
    }

    return lastStatus;
  }

  /**
   * Create an error result
   */
  private createErrorResult(serviceName: ServiceName, error: string): RestartResult {
    return {
      serviceName,
      success: false,
      status: 'failed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      error,
    };
  }

  /**
   * Add entry to restart history
   */
  private addToHistory(entry: RestartHistoryEntry): void {
    this.restartHistory.unshift(entry);

    // Trim history if it exceeds maximum
    if (this.restartHistory.length > MAX_HISTORY_ENTRIES) {
      this.restartHistory = this.restartHistory.slice(0, MAX_HISTORY_ENTRIES);
    }
  }

  /**
   * Update current operation status
   */
  private updateOperationStatus(status: RestartStatus): void {
    if (this.currentOperation) {
      this.currentOperation.status = status;
    }
  }

  /**
   * Emit restart event to listeners
   */
  private emitEvent(event: RestartEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        // Don't let listener errors affect the restart operation
        console.error('Error in restart event listener:', error);
      }
    }
  }

  /**
   * Track restart metrics in Datadog
   */
  private trackRestartMetrics(result: RestartResult): void {
    const tags = {
      service: result.serviceName,
      status: result.status,
      success: result.success.toString(),
    };

    metrics.increment('service.restart.total', tags);

    if (result.success) {
      metrics.increment('service.restart.success', tags);
    } else {
      metrics.increment('service.restart.failure', tags);
    }

    if (result.durationMs) {
      metrics.histogram('service.restart.duration', result.durationMs, tags);
    }
  }

  /**
   * Start a Datadog span for restart tracing
   */
  private startRestartSpan(serviceName: ServiceName): Span | null {
    try {
      const span = tracer.startSpan('service.restart', {
        tags: {
          'service.name': 'vibecode-webgui',
          'restart.service': serviceName,
          'span.kind': 'internal',
        },
      });
      return span;
    } catch {
      // Tracing may not be initialized in all environments
      return null;
    }
  }

  /**
   * Finish a Datadog span with result tags
   */
  private finishRestartSpan(span: Span | null, result: RestartResult): void {
    if (!span) return;

    try {
      const tags: Partial<RestartSpanTags> = {
        'restart.service': result.serviceName,
        'restart.status': result.status,
        'restart.success': result.success,
        'restart.duration_ms': result.durationMs,
        'restart.health_verified': result.healthStatus !== undefined,
      };

      if (!result.success) {
        tags.error = true;
        tags['error.msg'] = result.error;
      }

      Object.entries(tags).forEach(([key, value]) => {
        if (value !== undefined) {
          span.setTag(key, value);
        }
      });

      span.finish();
    } catch {
      // Silently ignore span finish errors
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance of the service restart manager
 */
export const serviceRestartManager = new ServiceRestartManager();

export default serviceRestartManager;
