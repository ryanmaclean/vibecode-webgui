/**
 * Kubernetes Health Check API Endpoint
 *
 * Returns Kubernetes cluster and pod health status including:
 * - Cluster connection status
 * - API server reachability
 * - Pod health across namespaces
 * - Node status
 *
 * Features:
 * - Rate limiting to prevent excessive kubectl calls
 * - Datadog tracing integration
 * - Detailed per-pod status
 * - Request ID tracking
 *
 * GET /api/health/kubernetes - Returns Kubernetes cluster and pod health
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createServiceLogger } from '@/lib/logging';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import type { KubernetesHealthResult, KubernetesClusterHealth, KubernetesPodHealth } from '@/types/unified-status';
import type { ServiceHealthStatus, AggregatedHealthStatus } from '@/types/health';

export const dynamic = 'force-dynamic';

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'health-kubernetes-api',
});

const execAsync = promisify(exec);
const KUBECTL_TIMEOUT_MS = 10000;
const apiRateLimit = createAPIRateLimit(60); // 60 requests per minute

/**
 * Parse pod status to health status
 */
function parsePodStatus(phase: string, readyContainers: number, totalContainers: number): AggregatedHealthStatus {
  if (phase === 'Running' && readyContainers === totalContainers) {
    return 'healthy';
  }
  if (phase === 'Running' && readyContainers < totalContainers) {
    return 'degraded';
  }
  if (phase === 'Pending' || phase === 'ContainerCreating') {
    return 'degraded';
  }
  return 'unhealthy';
}

/**
 * Get Kubernetes cluster health status
 */
async function getClusterHealth(): Promise<KubernetesClusterHealth> {
  const startTime = Date.now();

  try {
    // Check kubectl availability
    try {
      await execAsync('kubectl version --client --output=json', { timeout: KUBECTL_TIMEOUT_MS });
    } catch {
      return {
        clusterName: 'unknown',
        status: 'unhealthy',
        apiServerReachable: false,
        error: 'kubectl is not installed or not available',
      };
    }

    // Check cluster connection
    try {
      await execAsync('kubectl cluster-info', { timeout: KUBECTL_TIMEOUT_MS });
    } catch {
      return {
        clusterName: 'unknown',
        status: 'unhealthy',
        apiServerReachable: false,
        error: 'No Kubernetes cluster is connected',
      };
    }

    // Get cluster name from current context
    let clusterName = 'unknown';
    try {
      const contextResult = await execAsync('kubectl config current-context', { timeout: KUBECTL_TIMEOUT_MS });
      clusterName = contextResult.stdout.trim();
    } catch {
      // Use default name
    }

    // Get cluster version
    let version: string | undefined;
    try {
      const versionResult = await execAsync('kubectl version --output=json', { timeout: KUBECTL_TIMEOUT_MS });
      const versionData = JSON.parse(versionResult.stdout);
      version = versionData.serverVersion?.gitVersion;
    } catch {
      // Version is optional
    }

    // Get node status
    let nodeCount = 0;
    let readyNodes = 0;
    try {
      const nodesResult = await execAsync('kubectl get nodes --output=json', { timeout: KUBECTL_TIMEOUT_MS });
      const nodesData = JSON.parse(nodesResult.stdout);
      nodeCount = nodesData.items?.length || 0;

      readyNodes = nodesData.items?.filter((node: any) => {
        const conditions = node.status?.conditions || [];
        const readyCondition = conditions.find((c: any) => c.type === 'Ready');
        return readyCondition?.status === 'True';
      }).length || 0;
    } catch {
      // Node count is optional
    }

    const isHealthy = readyNodes > 0 && readyNodes === nodeCount;

    return {
      clusterName,
      status: isHealthy ? 'healthy' : readyNodes > 0 ? 'degraded' : 'unhealthy',
      version,
      nodeCount,
      readyNodes,
      apiServerReachable: true,
    };
  } catch (error) {
    return {
      clusterName: 'unknown',
      status: 'unhealthy',
      apiServerReachable: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get Kubernetes pod health statuses
 */
async function getPodHealth(): Promise<KubernetesPodHealth[]> {
  const pods: KubernetesPodHealth[] = [];

  try {
    // Get all pods across all namespaces
    const podsResult = await execAsync('kubectl get pods --all-namespaces --output=json', { timeout: KUBECTL_TIMEOUT_MS });
    const podsData = JSON.parse(podsResult.stdout);

    if (podsData.items && Array.isArray(podsData.items)) {
      for (const pod of podsData.items) {
        const name = pod.metadata?.name || 'unknown';
        const namespace = pod.metadata?.namespace || 'default';
        const phase = pod.status?.phase || 'Unknown';

        const containerStatuses = pod.status?.containerStatuses || [];
        const totalContainers = containerStatuses.length;
        const readyContainers = containerStatuses.filter((c: any) => c.ready === true).length;

        const restarts = containerStatuses.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0);

        const status = parsePodStatus(phase, readyContainers, totalContainers);

        pods.push({
          name,
          namespace,
          status,
          phase,
          readyContainers,
          totalContainers,
          restarts,
        });
      }
    }
  } catch (error) {
    log.warn('Failed to get pod health statuses', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return pods;
}

/**
 * GET handler for Kubernetes health endpoint
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();
  const clientIp =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const logContext = {
    requestId,
    clientIp,
    path: '/api/health/kubernetes',
  };

  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    log.warn('Rate limit exceeded for Kubernetes health check', logContext);

    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
          'X-Request-Id': requestId,
        },
      }
    );
  }

  try {
    log.info('Kubernetes health check requested', logContext);

    // Get cluster and pod health in parallel
    const [cluster, pods] = await Promise.all([
      getClusterHealth(),
      getPodHealth(),
    ]);

    // Calculate summary
    const totalPods = pods.length;
    const healthyPods = pods.filter((p) => p.status === 'healthy').length;
    const unhealthyPods = pods.filter((p) => p.status === 'unhealthy').length;

    // Determine overall status
    let overallStatus: AggregatedHealthStatus = 'healthy';
    if (cluster.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (cluster.status === 'degraded' || unhealthyPods > 0) {
      overallStatus = 'degraded';
    } else if (healthyPods < totalPods) {
      overallStatus = 'degraded';
    }

    const latencyMs = Date.now() - startTime;
    const lastChecked = new Date().toISOString();

    const healthResult: KubernetesHealthResult = {
      name: 'kubernetes',
      status: overallStatus,
      cluster,
      pods,
      latencyMs,
      lastChecked,
      summary: {
        totalPods,
        healthyPods,
        unhealthyPods,
      },
    };

    log.info('Kubernetes health check completed', {
      ...logContext,
      status: overallStatus,
      clusterName: cluster.clusterName,
      totalPods,
      healthyPods,
      unhealthyPods,
      latencyMs,
    });

    // Determine HTTP status based on overall health
    let httpStatus = 200;
    if (overallStatus === 'unhealthy') {
      httpStatus = 503;
    } else if (overallStatus === 'degraded') {
      httpStatus = 207; // Multi-Status - some pods are unhealthy
    }

    return NextResponse.json(healthResult, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Request-Id': requestId,
        'X-Response-Time': `${latencyMs}ms`,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const responseTime = Date.now() - startTime;

    log.error('Kubernetes health check failed', {
      ...logContext,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        name: 'kubernetes',
        status: 'unhealthy',
        cluster: {
          clusterName: 'unknown',
          status: 'unhealthy',
          apiServerReachable: false,
          error: errorMessage,
        },
        pods: [],
        latencyMs: responseTime,
        lastChecked: new Date().toISOString(),
        summary: {
          totalPods: 0,
          healthyPods: 0,
          unhealthyPods: 0,
        },
        error: process.env.NODE_ENV === 'development' ? errorMessage : 'Health check failed',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Request-Id': requestId,
          'X-Response-Time': `${responseTime}ms`,
        },
      }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const requestOrigin = request.headers.get('origin');

  // Get allowed origins from environment or use defaults
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001'
  ).split(',');

  // Check if origin is allowed
  const isAllowedOrigin = requestOrigin && allowedOrigins.includes(requestOrigin);

  return NextResponse.json(
    {},
    {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowedOrigin ? requestOrigin : allowedOrigins[0],
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    }
  );
}
