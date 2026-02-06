/**
 * Service Restart API Route
 *
 * POST /api/services/restart/[serviceName]
 * Restarts a specific service in the VM stack
 *
 * Supported services:
 * - ssh (Dropbear on port 2222)
 * - postgresql (port 5432)
 * - valkey (port 6379)
 * - openvscode (port 3000)
 * - docker (port 2375)
 *
 * Security: Requires authentication and applies rate limiting
 */

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from '@/lib/zod-compat';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { serviceRestartManager } from '@/lib/services/service-restart';
import type { ServiceName } from '@/types/health';
import type { RestartRequest } from '@/types/service-restart';

export const dynamic = 'force-dynamic';

/**
 * Rate limit: 10 restart requests per minute per user
 * Service restarts are expensive operations
 */
const apiRateLimit = createAPIRateLimit(10);

/**
 * Valid service names
 */
const VALID_SERVICES: ServiceName[] = ['ssh', 'postgresql', 'valkey', 'openvscode', 'docker'];

/**
 * Schema for restart request body
 */
const restartRequestSchema = z.object({
  force: z.boolean().optional().default(false),
  verifyHealth: z.boolean().optional().default(true),
  timeoutMs: z.number().min(5000).max(120000).optional(),
  maxHealthRetries: z.number().min(1).max(10).optional(),
  healthRetryDelayMs: z.number().min(500).max(10000).optional(),
}).strict();

/**
 * Validate service name from URL parameter
 */
function isValidServiceName(name: string): name is ServiceName {
  return VALID_SERVICES.includes(name as ServiceName);
}

/**
 * POST /api/services/restart/[serviceName]
 *
 * Restarts the specified service in the VM
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing serviceName
 * @returns JSON response with restart result
 *
 * @example Request
 * ```
 * POST /api/services/restart/postgresql
 * Content-Type: application/json
 *
 * {
 *   "verifyHealth": true,
 *   "timeoutMs": 30000
 * }
 * ```
 *
 * @example Response
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "serviceName": "postgresql",
 *     "success": true,
 *     "status": "completed",
 *     "startedAt": "2024-01-15T10:30:00.000Z",
 *     "completedAt": "2024-01-15T10:30:15.000Z",
 *     "durationMs": 15000,
 *     "healthStatus": "healthy"
 *   }
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serviceName: string }> }
) {
  // Await params as required by Next.js 15
  const { serviceName } = await params;

  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many restart requests. Please wait before trying again.',
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    );
  }

  // Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication required',
      },
      { status: 401 }
    );
  }

  // Validate service name
  if (!isValidServiceName(serviceName)) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid service name: ${serviceName}`,
        validServices: VALID_SERVICES,
      },
      { status: 400 }
    );
  }

  try {
    // Parse and validate request body
    let requestBody: z.infer<typeof restartRequestSchema> = {
      force: false,
      verifyHealth: true,
    };

    try {
      const body = await request.json();
      requestBody = restartRequestSchema.parse(body);
    } catch (parseError) {
      // If body parsing fails, use defaults (empty body is acceptable)
      if (parseError instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid request parameters',
            details: parseError.issues,
          },
          { status: 400 }
        );
      }
      // For JSON parse errors, use defaults
    }

    // Build restart request
    const restartRequest: RestartRequest = {
      serviceName,
      force: requestBody.force,
      verifyHealth: requestBody.verifyHealth,
      timeoutMs: requestBody.timeoutMs,
      maxHealthRetries: requestBody.maxHealthRetries,
      healthRetryDelayMs: requestBody.healthRetryDelayMs,
      requestedBy: session.user.email || session.user.name || 'unknown',
    };

    console.info('Service restart requested', {
      serviceName,
      requestedBy: restartRequest.requestedBy,
      force: requestBody.force,
      verifyHealth: requestBody.verifyHealth,
    });

    // Execute restart
    const result = await serviceRestartManager.restartService(restartRequest);

    // Log result
    if (result.success) {
      console.info('Service restart completed successfully', {
        serviceName,
        durationMs: result.durationMs,
        healthStatus: result.healthStatus,
      });
    } else {
      console.warn('Service restart failed', {
        serviceName,
        error: result.error,
        exitCode: result.exitCode,
      });
    }

    // Return result with appropriate status code
    const statusCode = result.success ? 200 : 500;

    return NextResponse.json(
      {
        success: result.success,
        data: result,
      },
      { status: statusCode }
    );
  } catch (error) {
    console.error('Error during service restart', {
      serviceName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to restart service',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/services/restart/[serviceName]
 *
 * Gets the restart status and history for a specific service
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing serviceName
 * @returns JSON response with restart status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serviceName: string }> }
) {
  // Await params as required by Next.js 15
  const { serviceName } = await params;

  // Rate limiting (higher limit for GET requests)
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many requests',
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    );
  }

  // Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication required',
      },
      { status: 401 }
    );
  }

  // Validate service name
  if (!isValidServiceName(serviceName)) {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid service name: ${serviceName}`,
        validServices: VALID_SERVICES,
      },
      { status: 400 }
    );
  }

  try {
    // Get URL parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const since = url.searchParams.get('since') || undefined;

    // Get current operation status
    const currentStatus = serviceRestartManager.getRestartStatus();

    // Get restart history for this service
    const history = serviceRestartManager.getRestartHistory({
      serviceName,
      limit: Math.min(limit, 100), // Cap at 100
      since,
    });

    return NextResponse.json({
      success: true,
      data: {
        serviceName,
        currentOperation:
          currentStatus?.serviceName === serviceName ? currentStatus : null,
        history,
      },
    });
  } catch (error) {
    console.error('Error fetching restart status', {
      serviceName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch restart status',
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/services/restart/[serviceName]
 *
 * CORS preflight handler
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '3600',
    },
  });
}
