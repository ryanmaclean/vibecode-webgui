/**
 * WebSocket Status Endpoint
 *
 * Provides real-time health status updates to desktop clients via WebSocket.
 * Features:
 * - Accepts WebSocket upgrade requests
 * - Authenticates clients via session or API key
 * - Sends initial status snapshot on connect
 * - Pushes updates when health status changes
 * - Includes heartbeat mechanism
 *
 * PAPA Agent Implementation - Desktop Client Integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStatusWebSocketService } from '@/lib/health/status-websocket';
import { getCachedHealthChecks } from '@/lib/health/unified-health-service';
import { createServiceLogger } from '@/lib/logging';
import {
  HealthCheckResult,
  ServiceHealth,
  HealthStatus,
} from '@/types/status-events';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'ws-status-route',
});

/**
 * Health check polling interval for WebSocket updates (5 seconds)
 */
const HEALTH_CHECK_INTERVAL = 5000;

/**
 * Global health check timer
 */
let healthCheckTimer: NodeJS.Timeout | null = null;

/**
 * Start periodic health checks if not already running
 */
function startHealthCheckPolling(): void {
  if (healthCheckTimer) {
    return;
  }

  log.info('Starting health check polling for WebSocket updates');

  healthCheckTimer = setInterval(async () => {
    try {
      const service = getStatusWebSocketService();

      // Only poll if there are connected clients
      if (service.getConnectionCount() === 0) {
        return;
      }

      const healthResult = await performHealthCheck();
      service.updateHealthStatus(healthResult);
    } catch (error) {
      log.error('Health check polling error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, HEALTH_CHECK_INTERVAL);
}

/**
 * Stop health check polling
 */
function stopHealthCheckPolling(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
    log.info('Stopped health check polling');
  }
}

/**
 * Perform health check and return result
 * Uses the unified health service for comprehensive stack health
 */
async function performHealthCheck(): Promise<HealthCheckResult> {
  try {
    // Use the unified health service for comprehensive checks
    const healthResponse = await getCachedHealthChecks();

    // Convert unified health service response to WebSocket format
    const services: ServiceHealth[] = healthResponse.services.map((svc) => ({
      name: svc.name,
      status: mapStatus(svc.status),
      message: svc.error,
      lastCheck: svc.lastChecked,
      responseTime: svc.latencyMs,
      details: svc.details,
    }));

    // Map aggregated status to HealthStatus
    const overallStatus: HealthStatus = mapStatus(healthResponse.status);

    return {
      services,
      overallStatus,
      timestamp: healthResponse.timestamp,
    };
  } catch (error) {
    log.error('Failed to perform health check', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      services: [
        {
          name: 'health-system',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
          lastCheck: new Date().toISOString(),
        },
      ],
      overallStatus: 'unhealthy',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Map health check status string to HealthStatus
 */
function mapStatus(status: string): HealthStatus {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'ok':
    case 'success':
      return 'healthy';
    case 'warning':
    case 'degraded':
      return 'degraded';
    case 'error':
    case 'unhealthy':
    case 'failed':
      return 'unhealthy';
    default:
      return 'unknown';
  }
}

/**
 * Extract client IP from request
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

/**
 * Validate API key for desktop client authentication
 */
function validateApiKey(apiKey: string): { valid: boolean; userId?: string } {
  // Check against environment-configured API keys
  const validKeys = (process.env.DESKTOP_API_KEYS || '').split(',').filter(Boolean);

  if (validKeys.length === 0) {
    // If no API keys configured, allow in development
    if (process.env.NODE_ENV === 'development') {
      return { valid: true, userId: 'development-user' };
    }
    return { valid: false };
  }

  // API keys can be in format: key:userId
  for (const keyEntry of validKeys) {
    const [key, userId] = keyEntry.split(':');
    if (key === apiKey) {
      return { valid: true, userId: userId || 'api-key-user' };
    }
  }

  return { valid: false };
}

/**
 * Handle WebSocket upgrade request
 */
export async function GET(request: NextRequest) {
  const upgrade = request.headers.get('upgrade');

  // Check if this is a WebSocket upgrade request
  if (upgrade?.toLowerCase() !== 'websocket') {
    // Return service status information for regular HTTP requests
    const service = getStatusWebSocketService();
    const metrics = service.getMetrics();

    return NextResponse.json(
      {
        service: 'websocket-status',
        status: 'running',
        connections: metrics.totalConnections,
        uptime: metrics.uptime,
        protocol: 'ws',
        endpoint: '/api/ws/status',
        features: [
          'real-time health updates',
          'heartbeat mechanism (30s)',
          'service filtering',
          'rate limiting (1/s)',
        ],
      },
      { status: 200 }
    );
  }

  const clientIp = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || undefined;

  log.info('WebSocket upgrade request', {
    clientIp,
    userAgent,
  });

  // Authentication: Check session or API key
  let userId: string | undefined;
  let authenticated = false;

  // Try session authentication
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    userId = session.user.id;
    authenticated = true;
    log.debug('Authenticated via session', { userId });
  }

  // Try API key authentication if no session
  if (!authenticated) {
    const apiKey = request.headers.get('x-api-key') ||
                   request.nextUrl.searchParams.get('api_key');

    if (apiKey) {
      const validation = validateApiKey(apiKey);
      if (validation.valid) {
        userId = validation.userId;
        authenticated = true;
        log.debug('Authenticated via API key', { userId });
      } else {
        log.warn('Invalid API key', { clientIp });
      }
    }
  }

  // In production, require authentication
  if (process.env.NODE_ENV === 'production' && !authenticated) {
    log.warn('Unauthenticated WebSocket request rejected', { clientIp });
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Get WebSocket service and perform initial health check
  const service = getStatusWebSocketService();

  // Start health check polling if not already running
  startHealthCheckPolling();

  // For Next.js App Router WebSocket handling, we return a response
  // that signals the upgrade should occur
  // The actual WebSocket handling needs to be done via a custom server or middleware

  // Note: Next.js App Router doesn't natively support WebSocket in route handlers
  // This response signals that the upgrade was accepted, but actual WebSocket
  // handling requires additional server configuration

  return new NextResponse(null, {
    status: 101,
    headers: {
      Upgrade: 'websocket',
      Connection: 'Upgrade',
      'Sec-WebSocket-Accept': 'acknowledged',
    },
  });
}

/**
 * Handle CORS preflight for WebSocket connections
 */
export async function OPTIONS(request: NextRequest) {
  const requestOrigin = request.headers.get('origin');

  // Get allowed origins
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // Default allowed origins
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:8080',
    'tauri://localhost',
    'https://tauri.localhost',
  ];

  const allAllowedOrigins = [...new Set([...defaultOrigins, ...allowedOrigins])];

  const isAllowedOrigin = requestOrigin && allAllowedOrigins.includes(requestOrigin);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-API-Key, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Protocol',
    'Access-Control-Max-Age': '3600',
  };

  if (isAllowedOrigin) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    headers['Vary'] = 'Origin';
  }

  return new NextResponse(null, {
    status: 200,
    headers,
  });
}

/**
 * WebSocket server handler (for use with custom server setup)
 * This function should be called from a custom server that handles
 * WebSocket upgrades outside of Next.js route handlers
 */
export function handleWebSocketUpgrade(
  ws: WebSocket,
  clientIp: string,
  userAgent?: string,
  userId?: string
): string {
  const service = getStatusWebSocketService();

  // Start health check polling
  startHealthCheckPolling();

  // Handle the connection
  const connectionId = service.handleConnection(
    ws as any, // Type cast for WebSocket compatibility
    clientIp,
    userAgent,
    userId
  );

  // Perform initial health check
  performHealthCheck().then((healthResult) => {
    service.updateHealthStatus(healthResult);
  });

  return connectionId;
}

/**
 * Create WebSocket server for standalone deployment
 * This can be used when running Next.js with a custom server
 */
export function createStatusWebSocketServer(server: any): void {
  const WebSocketServer = require('ws').WebSocketServer;

  const wss = new WebSocketServer({
    server,
    path: '/api/ws/status',
  });

  log.info('WebSocket Status Server created');

  wss.on('connection', async (ws: WebSocket, request: any) => {
    const clientIp =
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.socket.remoteAddress ||
      'unknown';

    const userAgent = request.headers['user-agent'];

    // Extract API key from headers or query
    const url = new URL(request.url, `http://${request.headers.host}`);
    const apiKey =
      request.headers['x-api-key'] || url.searchParams.get('api_key');

    let userId: string | undefined;

    // Validate API key if provided
    if (apiKey) {
      const validation = validateApiKey(apiKey);
      if (validation.valid) {
        userId = validation.userId;
      } else if (process.env.NODE_ENV === 'production') {
        log.warn('Invalid API key, closing connection', { clientIp });
        ws.close(4001, 'Invalid API key');
        return;
      }
    } else if (process.env.NODE_ENV === 'production') {
      log.warn('No API key provided, closing connection', { clientIp });
      ws.close(4001, 'API key required');
      return;
    }

    handleWebSocketUpgrade(ws, clientIp, userAgent, userId);
  });

  wss.on('error', (error: Error) => {
    log.error('WebSocket Server error', {
      error: error.message,
    });
  });

  // Clean up on server close
  wss.on('close', () => {
    stopHealthCheckPolling();
    log.info('WebSocket Status Server closed');
  });
}

// Export for external use
export { performHealthCheck, startHealthCheckPolling, stopHealthCheckPolling };
