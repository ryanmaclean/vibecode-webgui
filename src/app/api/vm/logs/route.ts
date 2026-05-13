/**
 * VM Logs API
 *
 * GET /api/vm/logs - Retrieve service logs
 *
 * Query parameters:
 *   ?service=ssh|postgresql|valkey|openvscode|docker  - Filter by service
 *   ?level=info|warning|error|debug                   - Filter by log level
 *   ?limit=100                                        - Max entries to return (default 200)
 *
 * Returns: { logs: LogEntry[], services: string[] }
 *
 * Currently returns empty results — real log ingestion is not yet wired up.
 * The response shape is stable so the frontend can integrate immediately.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServiceLogger } from '@/lib/logging';

export const dynamic = 'force-dynamic';

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'api-vm-logs',
});

/** Services that can emit logs */
type Service = 'ssh' | 'postgresql' | 'valkey' | 'openvscode' | 'docker';

const VALID_SERVICES: Service[] = ['ssh', 'postgresql', 'valkey', 'openvscode', 'docker'];

/** Log severity levels */
type LogLevel = 'info' | 'warning' | 'error' | 'debug';

const VALID_LEVELS: LogLevel[] = ['info', 'warning', 'error', 'debug'];

/** A single log entry returned to the client */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: Service;
}

/** Shape of the JSON response */
interface VMLogsResponse {
  logs: LogEntry[];
  services: Service[];
}

/**
 * GET /api/vm/logs
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);

    const serviceParam = searchParams.get('service');
    if (serviceParam && !VALID_SERVICES.includes(serviceParam as Service)) {
      return NextResponse.json(
        {
          error: 'Invalid service name',
          message: `Valid services are: ${VALID_SERVICES.join(', ')}`,
        },
        { status: 400 },
      );
    }

    const levelParam = searchParams.get('level');
    if (levelParam && !VALID_LEVELS.includes(levelParam as LogLevel)) {
      return NextResponse.json(
        {
          error: 'Invalid log level',
          message: `Valid levels are: ${VALID_LEVELS.join(', ')}`,
        },
        { status: 400 },
      );
    }

    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 200, 1), 1000) : 200;

    log.info('VM logs requested', {
      userId: session.user?.id,
      service: serviceParam ?? 'all',
      level: levelParam ?? 'all',
      limit,
    });

    // Return empty results — real log ingestion is not yet wired up.
    const response: VMLogsResponse = {
      logs: [],
      services: VALID_SERVICES,
    };

    return NextResponse.json(response);
  } catch (error) {
    log.error('Failed to fetch VM logs', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
