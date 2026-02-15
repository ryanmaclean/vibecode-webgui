/**
 * VM Health Check Utilities
 * Provides reliable health checking for VM processes, network connectivity, and boot status
 */

import { logger } from '@/lib/logger';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as net from 'net';

const exec = promisify(execCallback);

/**
 * Options for health check operations
 */
export interface HealthCheckOptions {
  /** Timeout in milliseconds (default: 5000ms) */
  timeout?: number;

  /** Polling interval in milliseconds (default: 100ms) */
  interval?: number;

  /** Maximum number of polling attempts (default: 50) */
  maxAttempts?: number;

  /** Operation name for logging */
  operationName?: string;

  /** Additional context for logging */
  context?: Record<string, unknown>;
}

/**
 * Result of a health check operation
 */
export interface HealthCheckResult {
  /** Whether the health check passed */
  healthy: boolean;

  /** Reason for health status */
  reason?: string;

  /** Number of attempts made */
  attempts: number;

  /** Total duration in milliseconds */
  duration: number;

  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Default health check configuration
 */
const DEFAULT_OPTIONS: Required<Omit<HealthCheckOptions, 'operationName' | 'context'>> = {
  timeout: 5000,
  interval: 100,
  maxAttempts: 50,
};

/**
 * Sleep for specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a process is running by PID
 *
 * @param pid - Process ID to check
 * @returns Promise resolving to true if process is running
 *
 * @example
 * ```typescript
 * const isRunning = await isProcessRunning(12345);
 * if (isRunning) {
 *   console.log('Process is active');
 * }
 * ```
 */
export async function isProcessRunning(pid: number): Promise<boolean> {
  try {
    // Send signal 0 to check if process exists without actually sending a signal
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // ESRCH means process doesn't exist
    // EPERM means process exists but we don't have permission to signal it
    if ((error as NodeJS.ErrnoException).code === 'EPERM') {
      return true;
    }
    return false;
  }
}

/**
 * Check if a process from a PID file is running
 *
 * @param pidPath - Path to PID file
 * @returns Promise resolving to HealthCheckResult
 *
 * @example
 * ```typescript
 * const result = await checkProcessHealth('/var/run/vm.pid');
 * if (!result.healthy) {
 *   console.error('VM process not running:', result.reason);
 * }
 * ```
 */
export async function checkProcessHealth(pidPath: string): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Read PID file
    const pidContent = await fs.readFile(pidPath, 'utf-8');
    const pid = parseInt(pidContent.trim(), 10);

    if (isNaN(pid)) {
      return {
        healthy: false,
        reason: 'Invalid PID in file',
        attempts: 1,
        duration: Date.now() - startTime,
        details: { pidPath, pidContent },
      };
    }

    // Check if process is running
    const running = await isProcessRunning(pid);

    return {
      healthy: running,
      reason: running ? 'Process is running' : 'Process not found',
      attempts: 1,
      duration: Date.now() - startTime,
      details: { pid, pidPath },
    };
  } catch (error) {
    return {
      healthy: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
      attempts: 1,
      duration: Date.now() - startTime,
      details: { pidPath },
    };
  }
}

/**
 * Check if a TCP port is accepting connections
 *
 * @param host - Host to connect to
 * @param port - Port to check
 * @param timeout - Connection timeout in milliseconds (default: 1000ms)
 * @returns Promise resolving to true if port is reachable
 *
 * @example
 * ```typescript
 * const isReachable = await isPortReachable('localhost', 8080);
 * if (isReachable) {
 *   console.log('Service is ready');
 * }
 * ```
 */
export async function isPortReachable(
  host: string,
  port: number,
  timeout: number = 1000
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    const onError = () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    };

    const onTimeout = () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    };

    const onConnect = () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(true);
      }
    };

    socket.setTimeout(timeout);
    socket.once('error', onError);
    socket.once('timeout', onTimeout);
    socket.once('connect', onConnect);

    socket.connect(port, host);
  });
}

/**
 * Wait for a TCP port to become reachable
 *
 * @param host - Host to connect to
 * @param port - Port to check
 * @param options - Health check options
 * @returns Promise resolving to HealthCheckResult
 *
 * @example
 * ```typescript
 * const result = await waitForPort('localhost', 8080, { timeout: 30000 });
 * if (result.healthy) {
 *   console.log('Service is ready after', result.duration, 'ms');
 * }
 * ```
 */
export async function waitForPort(
  host: string,
  port: number,
  options: HealthCheckOptions = {}
): Promise<HealthCheckResult> {
  const maxAttempts = options.maxAttempts || DEFAULT_OPTIONS.maxAttempts;
  const interval = options.interval || DEFAULT_OPTIONS.interval;
  const operationName = options.operationName || 'wait-for-port';
  const context = options.context || {};

  const startTime = Date.now();
  const timeout = options.timeout || DEFAULT_OPTIONS.timeout;
  const deadline = startTime + timeout;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Check if we've exceeded timeout
    if (Date.now() >= deadline) {
      logger.warn(`${operationName} timed out`, {
        host,
        port,
        attempt,
        timeout,
        ...context,
      });

      return {
        healthy: false,
        reason: 'Timeout waiting for port',
        attempts: attempt,
        duration: Date.now() - startTime,
        details: { host, port, timeout },
      };
    }

    logger.debug(`Checking port ${host}:${port}`, {
      attempt,
      maxAttempts,
      ...context,
    });

    const reachable = await isPortReachable(host, port, 1000);

    if (reachable) {
      const duration = Date.now() - startTime;

      logger.info(`${operationName} succeeded`, {
        host,
        port,
        attempt,
        duration,
        ...context,
      });

      return {
        healthy: true,
        reason: 'Port is reachable',
        attempts: attempt,
        duration,
        details: { host, port },
      };
    }

    // Wait before next attempt
    if (attempt < maxAttempts) {
      await sleep(interval);
    }
  }

  return {
    healthy: false,
    reason: 'Port not reachable after max attempts',
    attempts: maxAttempts,
    duration: Date.now() - startTime,
    details: { host, port },
  };
}

/**
 * Parse console/log output for boot completion markers
 *
 * @param logContent - Console or log file content
 * @param bootMarkers - Array of strings indicating successful boot (default: common Linux boot markers)
 * @returns true if any boot marker is found
 *
 * @example
 * ```typescript
 * const logContent = await fs.readFile('/var/log/vm-console.log', 'utf-8');
 * const isBooted = parseBootStatus(logContent);
 * if (isBooted) {
 *   console.log('VM has completed boot sequence');
 * }
 * ```
 */
export function parseBootStatus(
  logContent: string,
  bootMarkers: string[] = [
    'login:',
    'Welcome to Alpine Linux',
    'Alpine Linux',
    'localhost login:',
    'systemd: Startup finished',
    'cloud-init',
    'SSH server started',
  ]
): boolean {
  const lowerContent = logContent.toLowerCase();

  for (const marker of bootMarkers) {
    if (lowerContent.includes(marker.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Wait for VM boot by monitoring console log
 *
 * @param logPath - Path to console log file
 * @param options - Health check options
 * @param bootMarkers - Optional custom boot markers
 * @returns Promise resolving to HealthCheckResult
 *
 * @example
 * ```typescript
 * const result = await waitForBoot('/path/to/console.log', { timeout: 60000 });
 * if (result.healthy) {
 *   console.log('VM booted successfully');
 * }
 * ```
 */
export async function waitForBoot(
  logPath: string,
  options: HealthCheckOptions = {},
  bootMarkers?: string[]
): Promise<HealthCheckResult> {
  const maxAttempts = options.maxAttempts || DEFAULT_OPTIONS.maxAttempts;
  const interval = options.interval || DEFAULT_OPTIONS.interval;
  const operationName = options.operationName || 'wait-for-boot';
  const context = options.context || {};

  const startTime = Date.now();
  const timeout = options.timeout || DEFAULT_OPTIONS.timeout;
  const deadline = startTime + timeout;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Check if we've exceeded timeout
    if (Date.now() >= deadline) {
      logger.warn(`${operationName} timed out`, {
        logPath,
        attempt,
        timeout,
        ...context,
      });

      return {
        healthy: false,
        reason: 'Timeout waiting for boot',
        attempts: attempt,
        duration: Date.now() - startTime,
        details: { logPath, timeout },
      };
    }

    try {
      logger.debug(`Checking boot status from log`, {
        logPath,
        attempt,
        maxAttempts,
        ...context,
      });

      const logContent = await fs.readFile(logPath, 'utf-8');
      const booted = parseBootStatus(logContent, bootMarkers);

      if (booted) {
        const duration = Date.now() - startTime;

        logger.info(`${operationName} succeeded`, {
          logPath,
          attempt,
          duration,
          ...context,
        });

        return {
          healthy: true,
          reason: 'Boot markers found in log',
          attempts: attempt,
          duration,
          details: { logPath },
        };
      }
    } catch (error) {
      // Log file might not exist yet, continue polling
      logger.debug(`Log file not readable`, {
        logPath,
        attempt,
        error: error instanceof Error ? error.message : 'Unknown error',
        ...context,
      });
    }

    // Wait before next attempt
    if (attempt < maxAttempts) {
      await sleep(interval);
    }
  }

  return {
    healthy: false,
    reason: 'Boot markers not found after max attempts',
    attempts: maxAttempts,
    duration: Date.now() - startTime,
    details: { logPath },
  };
}

/**
 * Comprehensive VM health check
 * Combines process, port, and boot status checks
 *
 * @param checks - Health check configuration
 * @param options - Health check options
 * @returns Promise resolving to HealthCheckResult
 *
 * @example
 * ```typescript
 * const result = await checkVMHealth({
 *   pidPath: '/var/run/vm.pid',
 *   port: { host: 'localhost', port: 22 },
 *   logPath: '/var/log/console.log'
 * }, { timeout: 30000 });
 *
 * if (result.healthy) {
 *   console.log('VM is fully healthy');
 * }
 * ```
 */
export async function checkVMHealth(
  checks: {
    pidPath?: string;
    port?: { host: string; port: number };
    logPath?: string;
    bootMarkers?: string[];
  },
  options: HealthCheckOptions = {}
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const operationName = options.operationName || 'vm-health-check';
  const context = options.context || {};
  const results: Array<{ check: string; result: HealthCheckResult }> = [];

  logger.debug(`Starting comprehensive VM health check`, {
    checks: Object.keys(checks),
    ...context,
  });

  // Check process health
  if (checks.pidPath) {
    const processResult = await checkProcessHealth(checks.pidPath);
    results.push({ check: 'process', result: processResult });

    if (!processResult.healthy) {
      logger.warn(`Process health check failed`, {
        reason: processResult.reason,
        ...context,
      });

      return {
        healthy: false,
        reason: `Process check failed: ${processResult.reason}`,
        attempts: 1,
        duration: Date.now() - startTime,
        details: { checks: results },
      };
    }
  }

  // Check port reachability
  if (checks.port) {
    const portResult = await waitForPort(
      checks.port.host,
      checks.port.port,
      options
    );
    results.push({ check: 'port', result: portResult });

    if (!portResult.healthy) {
      logger.warn(`Port health check failed`, {
        reason: portResult.reason,
        ...context,
      });

      return {
        healthy: false,
        reason: `Port check failed: ${portResult.reason}`,
        attempts: portResult.attempts,
        duration: Date.now() - startTime,
        details: { checks: results },
      };
    }
  }

  // Check boot status
  if (checks.logPath) {
    const bootResult = await waitForBoot(
      checks.logPath,
      options,
      checks.bootMarkers
    );
    results.push({ check: 'boot', result: bootResult });

    if (!bootResult.healthy) {
      logger.warn(`Boot health check failed`, {
        reason: bootResult.reason,
        ...context,
      });

      return {
        healthy: false,
        reason: `Boot check failed: ${bootResult.reason}`,
        attempts: bootResult.attempts,
        duration: Date.now() - startTime,
        details: { checks: results },
      };
    }
  }

  const duration = Date.now() - startTime;

  logger.info(`${operationName} succeeded - all checks passed`, {
    duration,
    checksPerformed: results.length,
    ...context,
  });

  return {
    healthy: true,
    reason: 'All health checks passed',
    attempts: Math.max(...results.map(r => r.result.attempts), 1),
    duration,
    details: { checks: results },
  };
}
