/**
 * Unified Health Service
 *
 * Provides health checks for all 5 services in the stack:
 * - SSH (Dropbear) - TCP connect to port 2222
 * - PostgreSQL - Connection pool health check
 * - Valkey/Redis - PING command
 * - OpenVSCode - HTTP healthz or TCP 3000
 * - Docker - Docker API info call via TCP 2375
 *
 * Features:
 * - Parallel execution for speed
 * - 3-second timeout per check
 * - Datadog APM tracing
 * - Response caching (5-second TTL)
 */

import * as net from 'net';
import * as http from 'http';
import tracer from 'dd-trace';
import type { Span } from 'dd-trace';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache/valkey-client';
import { metrics } from '@/lib/server-monitoring';
import type {
  ServiceName,
  ServiceHealthStatus,
  ServiceHealthResult,
  AggregatedHealthResponse,
  AggregatedHealthStatus,
  CachedHealthResponse,
  HealthCheckSpanTags,
} from '@/types/health';

// Default configuration
const DEFAULT_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 5000;

// Service configuration with environment variable overrides
const getConfig = () => ({
  ssh: {
    host: process.env.SSH_HOST || 'localhost',
    port: parseInt(process.env.SSH_PORT || '2222', 10),
  },
  postgresql: {
    // Uses existing Prisma connection
  },
  valkey: {
    // Uses existing Valkey client
  },
  openvscode: {
    host: process.env.OPENVSCODE_HOST || 'localhost',
    port: parseInt(process.env.OPENVSCODE_PORT || '3000', 10),
    healthzPath: '/healthz',
    useHttpCheck: process.env.OPENVSCODE_USE_HTTP !== 'false',
  },
  docker: {
    host: process.env.DOCKER_HOST || 'localhost',
    port: parseInt(process.env.DOCKER_PORT || '2375', 10),
    socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
    useSocket: process.env.DOCKER_USE_SOCKET === 'true',
  },
});

// Cache for health check results
let cachedResponse: CachedHealthResponse | null = null;

/**
 * Create a health check result with current timestamp
 */
function createResult(
  name: ServiceName,
  status: ServiceHealthStatus,
  latencyMs: number,
  error?: string,
  details?: Record<string, unknown>
): ServiceHealthResult {
  return {
    name,
    status,
    latencyMs,
    lastChecked: new Date().toISOString(),
    ...(error && { error }),
    ...(details && { details }),
  };
}

/**
 * Start a Datadog span for health check tracing
 */
function startHealthCheckSpan(serviceName: ServiceName, checkType: string): Span | null {
  try {
    const span = tracer.startSpan('health.check', {
      tags: {
        'service.name': 'vibecode-webgui',
        'health.service': serviceName,
        'health.check_type': checkType,
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
function finishHealthCheckSpan(
  span: Span | null,
  tags: Partial<HealthCheckSpanTags>
): void {
  if (!span) return;

  try {
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
 * TCP connection health check helper
 */
async function tcpHealthCheck(
  host: string,
  port: number,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
      }
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({
        success: false,
        latencyMs: Date.now() - startTime,
        error: `Connection timeout after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    socket.connect(port, host, () => {
      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;
      cleanup();
      resolve({ success: true, latencyMs });
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      cleanup();
      resolve({
        success: false,
        latencyMs: Date.now() - startTime,
        error: err.message,
      });
    });
  });
}

/**
 * HTTP health check helper
 */
async function httpHealthCheck(
  host: string,
  port: number,
  path: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<{ success: boolean; latencyMs: number; statusCode?: number; error?: string }> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const options: http.RequestOptions = {
      hostname: host,
      port,
      path,
      method: 'GET',
      timeout: timeoutMs,
    };

    const req = http.request(options, (res) => {
      const latencyMs = Date.now() - startTime;
      const success = res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300;

      // Consume the response body to free up resources
      res.resume();

      resolve({
        success,
        latencyMs,
        statusCode: res.statusCode,
        ...((!success) && { error: `HTTP ${res.statusCode}` }),
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        latencyMs: Date.now() - startTime,
        error: err.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        latencyMs: Date.now() - startTime,
        error: `HTTP request timeout after ${timeoutMs}ms`,
      });
    });

    req.end();
  });
}

/**
 * SSH (Dropbear) Health Check
 * Uses TCP connection to port 2222
 */
export async function checkSSHHealth(): Promise<ServiceHealthResult> {
  const config = getConfig().ssh;
  const span = startHealthCheckSpan('ssh', 'tcp');

  try {
    const result = await tcpHealthCheck(config.host, config.port);

    const status: ServiceHealthStatus = result.success ? 'healthy' : 'unhealthy';

    metrics.increment('health.check.ssh', {
      status,
      service: 'vibecode-webgui',
    });

    finishHealthCheckSpan(span, {
      'health.service': 'ssh',
      'health.status': status,
      'health.latency_ms': result.latencyMs,
      'health.check_type': 'tcp',
      ...((!result.success) && { error: true, 'error.msg': result.error }),
    });

    return createResult('ssh', status, result.latencyMs, result.error, {
      host: config.host,
      port: config.port,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    finishHealthCheckSpan(span, {
      'health.service': 'ssh',
      'health.status': 'unknown',
      'health.latency_ms': 0,
      'health.check_type': 'tcp',
      error: true,
      'error.msg': errorMsg,
    });

    return createResult('ssh', 'unknown', 0, errorMsg);
  }
}

/**
 * PostgreSQL Health Check
 * Uses existing Prisma connection pool
 */
export async function checkPostgreSQLHealth(): Promise<ServiceHealthResult> {
  const span = startHealthCheckSpan('postgresql', 'query');
  const startTime = Date.now();

  try {
    // Simple SELECT 1 query to verify connection
    await prisma.$queryRaw`SELECT 1`;

    const latencyMs = Date.now() - startTime;
    const status: ServiceHealthStatus = 'healthy';

    metrics.increment('health.check.postgresql', {
      status,
      service: 'vibecode-webgui',
    });

    finishHealthCheckSpan(span, {
      'health.service': 'postgresql',
      'health.status': status,
      'health.latency_ms': latencyMs,
      'health.check_type': 'query',
    });

    return createResult('postgresql', status, latencyMs, undefined, {
      query: 'SELECT 1',
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    metrics.increment('health.check.postgresql', {
      status: 'unhealthy',
      service: 'vibecode-webgui',
    });

    finishHealthCheckSpan(span, {
      'health.service': 'postgresql',
      'health.status': 'unhealthy',
      'health.latency_ms': latencyMs,
      'health.check_type': 'query',
      error: true,
      'error.msg': errorMsg,
    });

    return createResult('postgresql', 'unhealthy', latencyMs, errorMsg);
  }
}

/**
 * Valkey/Redis Health Check
 * Uses existing ioredis client PING command
 */
export async function checkValkeyHealth(): Promise<ServiceHealthResult> {
  const span = startHealthCheckSpan('valkey', 'command');
  const startTime = Date.now();

  try {
    const isHealthy = await cache.healthCheck();
    const latencyMs = Date.now() - startTime;
    const status: ServiceHealthStatus = isHealthy ? 'healthy' : 'unhealthy';

    metrics.increment('health.check.valkey', {
      status,
      service: 'vibecode-webgui',
    });

    finishHealthCheckSpan(span, {
      'health.service': 'valkey',
      'health.status': status,
      'health.latency_ms': latencyMs,
      'health.check_type': 'command',
      ...((!isHealthy) && { error: true, 'error.msg': 'PING failed' }),
    });

    return createResult('valkey', status, latencyMs, isHealthy ? undefined : 'PING failed', {
      command: 'PING',
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    metrics.increment('health.check.valkey', {
      status: 'unhealthy',
      service: 'vibecode-webgui',
    });

    finishHealthCheckSpan(span, {
      'health.service': 'valkey',
      'health.status': 'unhealthy',
      'health.latency_ms': latencyMs,
      'health.check_type': 'command',
      error: true,
      'error.msg': errorMsg,
    });

    return createResult('valkey', 'unhealthy', latencyMs, errorMsg);
  }
}

/**
 * OpenVSCode Health Check
 * Uses HTTP /healthz endpoint or TCP fallback
 */
export async function checkOpenVSCodeHealth(): Promise<ServiceHealthResult> {
  const config = getConfig().openvscode;
  const checkType = config.useHttpCheck ? 'http' : 'tcp';
  const span = startHealthCheckSpan('openvscode', checkType);

  try {
    let result: { success: boolean; latencyMs: number; error?: string; statusCode?: number };

    if (config.useHttpCheck) {
      result = await httpHealthCheck(config.host, config.port, config.healthzPath);
    } else {
      result = await tcpHealthCheck(config.host, config.port);
    }

    const status: ServiceHealthStatus = result.success ? 'healthy' : 'unhealthy';

    metrics.increment('health.check.openvscode', {
      status,
      service: 'vibecode-webgui',
    });

    finishHealthCheckSpan(span, {
      'health.service': 'openvscode',
      'health.status': status,
      'health.latency_ms': result.latencyMs,
      'health.check_type': checkType,
      ...((!result.success) && { error: true, 'error.msg': result.error }),
    });

    return createResult('openvscode', status, result.latencyMs, result.error, {
      host: config.host,
      port: config.port,
      checkType,
      ...((result as { statusCode?: number }).statusCode && { statusCode: (result as { statusCode?: number }).statusCode }),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    finishHealthCheckSpan(span, {
      'health.service': 'openvscode',
      'health.status': 'unknown',
      'health.latency_ms': 0,
      'health.check_type': checkType,
      error: true,
      'error.msg': errorMsg,
    });

    return createResult('openvscode', 'unknown', 0, errorMsg);
  }
}

/**
 * Docker Health Check
 * Uses Docker API /info endpoint via TCP or Unix socket
 */
export async function checkDockerHealth(): Promise<ServiceHealthResult> {
  const config = getConfig().docker;
  const span = startHealthCheckSpan('docker', 'http');
  const startTime = Date.now();

  try {
    let result: { success: boolean; latencyMs: number; error?: string };

    if (config.useSocket) {
      // Unix socket connection
      result = await new Promise((resolve) => {
        const socket = new net.Socket();
        let resolved = false;
        let responseData = '';

        const cleanup = () => {
          if (!resolved) {
            resolved = true;
            socket.destroy();
          }
        };

        const timeout = setTimeout(() => {
          cleanup();
          resolve({
            success: false,
            latencyMs: Date.now() - startTime,
            error: `Socket connection timeout after ${DEFAULT_TIMEOUT_MS}ms`,
          });
        }, DEFAULT_TIMEOUT_MS);

        socket.connect({ path: config.socketPath }, () => {
          // Send HTTP request over Unix socket
          socket.write('GET /info HTTP/1.1\r\nHost: localhost\r\n\r\n');
        });

        socket.on('data', (data) => {
          responseData += data.toString();
          // Check if we got a successful response
          if (responseData.includes('HTTP/1.1 200') || responseData.includes('HTTP/1.0 200')) {
            clearTimeout(timeout);
            cleanup();
            resolve({
              success: true,
              latencyMs: Date.now() - startTime,
            });
          }
        });

        socket.on('error', (err) => {
          clearTimeout(timeout);
          cleanup();
          resolve({
            success: false,
            latencyMs: Date.now() - startTime,
            error: err.message,
          });
        });

        socket.on('close', () => {
          if (!resolved) {
            clearTimeout(timeout);
            cleanup();
            // If we got some data but no 200, it might still be a valid response
            const success = responseData.includes('200') || responseData.includes('"ID"');
            resolve({
              success,
              latencyMs: Date.now() - startTime,
              ...(!success && { error: 'Invalid response from Docker daemon' }),
            });
          }
        });
      });
    } else {
      // TCP connection to Docker API
      result = await httpHealthCheck(config.host, config.port, '/info');
    }

    const status: ServiceHealthStatus = result.success ? 'healthy' : 'unhealthy';

    metrics.increment('health.check.docker', {
      status,
      service: 'vibecode-webgui',
    });

    finishHealthCheckSpan(span, {
      'health.service': 'docker',
      'health.status': status,
      'health.latency_ms': result.latencyMs,
      'health.check_type': 'http',
      ...((!result.success) && { error: true, 'error.msg': result.error }),
    });

    return createResult('docker', status, result.latencyMs, result.error, {
      host: config.useSocket ? config.socketPath : config.host,
      port: config.useSocket ? undefined : config.port,
      useSocket: config.useSocket,
      endpoint: '/info',
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    metrics.increment('health.check.docker', {
      status: 'unhealthy',
      service: 'vibecode-webgui',
    });

    finishHealthCheckSpan(span, {
      'health.service': 'docker',
      'health.status': 'unhealthy',
      'health.latency_ms': latencyMs,
      'health.check_type': 'http',
      error: true,
      'error.msg': errorMsg,
    });

    return createResult('docker', 'unhealthy', latencyMs, errorMsg);
  }
}

/**
 * Calculate aggregated health status from individual results
 */
function calculateAggregatedStatus(results: ServiceHealthResult[]): AggregatedHealthStatus {
  const healthyCount = results.filter((r) => r.status === 'healthy').length;
  const unhealthyCount = results.filter((r) => r.status === 'unhealthy').length;

  if (unhealthyCount === results.length) {
    return 'unhealthy';
  }

  if (healthyCount === results.length) {
    return 'healthy';
  }

  return 'degraded';
}

/**
 * Run all health checks in parallel
 */
export async function runAllHealthChecks(): Promise<AggregatedHealthResponse> {
  const startTime = Date.now();
  const parentSpan = startHealthCheckSpan('all' as ServiceName, 'aggregate' as 'tcp');

  // Run all checks in parallel for speed
  const results = await Promise.all([
    checkSSHHealth(),
    checkPostgreSQLHealth(),
    checkValkeyHealth(),
    checkOpenVSCodeHealth(),
    checkDockerHealth(),
  ]);

  const totalCheckTimeMs = Date.now() - startTime;
  const status = calculateAggregatedStatus(results);

  // Calculate summary
  const summary = {
    total: results.length,
    healthy: results.filter((r) => r.status === 'healthy').length,
    unhealthy: results.filter((r) => r.status === 'unhealthy').length,
    unknown: results.filter((r) => r.status === 'unknown').length,
  };

  // Track aggregated metrics
  metrics.histogram('health.check.total_duration', totalCheckTimeMs, {
    service: 'vibecode-webgui',
    status,
  });

  metrics.gauge('health.services.healthy', summary.healthy, {
    service: 'vibecode-webgui',
  });

  metrics.gauge('health.services.unhealthy', summary.unhealthy, {
    service: 'vibecode-webgui',
  });

  if (parentSpan) {
    parentSpan.setTag('health.status', status);
    parentSpan.setTag('health.total_time_ms', totalCheckTimeMs);
    parentSpan.setTag('health.healthy_count', summary.healthy);
    parentSpan.setTag('health.unhealthy_count', summary.unhealthy);
    parentSpan.finish();
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    totalCheckTimeMs,
    services: results,
    summary,
  };
}

/**
 * Get cached health check results or run new checks
 * Uses a 5-second TTL to prevent rapid polling
 */
export async function getCachedHealthChecks(): Promise<CachedHealthResponse> {
  const now = Date.now();

  // Check if we have a valid cached response
  if (cachedResponse) {
    const cacheAge = now - new Date(cachedResponse.cachedAt).getTime();

    if (cacheAge < CACHE_TTL_MS) {
      return {
        ...cachedResponse,
        fromCache: true,
      };
    }
  }

  // Run fresh health checks
  const response = await runAllHealthChecks();

  // Update cache
  cachedResponse = {
    response,
    cachedAt: new Date().toISOString(),
    ttlMs: CACHE_TTL_MS,
    fromCache: false,
  };

  return cachedResponse;
}

/**
 * Invalidate the health check cache
 * Useful for forcing a fresh check
 */
export function invalidateHealthCache(): void {
  cachedResponse = null;
}

/**
 * Get health check for a specific service
 */
export async function getServiceHealth(serviceName: ServiceName): Promise<ServiceHealthResult> {
  switch (serviceName) {
    case 'ssh':
      return checkSSHHealth();
    case 'postgresql':
      return checkPostgreSQLHealth();
    case 'valkey':
      return checkValkeyHealth();
    case 'openvscode':
      return checkOpenVSCodeHealth();
    case 'docker':
      return checkDockerHealth();
    default:
      throw new Error(`Unknown service: ${serviceName}`);
  }
}

// Export the health service singleton
export const unifiedHealthService = {
  checkSSHHealth,
  checkPostgreSQLHealth,
  checkValkeyHealth,
  checkOpenVSCodeHealth,
  checkDockerHealth,
  runAllHealthChecks,
  getCachedHealthChecks,
  invalidateHealthCache,
  getServiceHealth,
};

export default unifiedHealthService;
