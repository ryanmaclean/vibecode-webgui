/**
 * IDE Session API - Unified endpoint for all IDE types
 * POST /api/ide/session - Create new IDE session
 * GET /api/ide/session - List all sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { IDEFactory, IDEConfig, IDEType } from '@/lib/ide';
import { getSessionStore } from '@/lib/ide/session/store';
import { createAPIRateLimit } from '@/lib/rate-limiting';

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(30); // 30 requests per minute

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
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

  try {
    // Authentication check
    const authSession = await getServerSession(authOptions);
    if (!authSession?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required to create IDE sessions' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { workspaceId, userId, type, projectPath, extensions, auth, port } = body;

    // Validate required fields
    if (!workspaceId || !userId) {
      return NextResponse.json(
        { error: 'workspaceId and userId are required' },
        { status: 400 }
      );
    }

    // Verify the userId matches the authenticated user to prevent session hijacking
    if (userId !== authSession.user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Cannot create IDE session for another user' },
        { status: 403 }
      );
    }

    // Get IDE type from request or use default
    const ideType: IDEType = type || IDEFactory.getDefaultIDEType();

    // Create IDE configuration
    const config: IDEConfig = {
      type: ideType,
      workspaceId,
      userId,
      projectPath: projectPath || '/workspace',
      extensions: extensions || [],
      auth,
      port,
    };

    // Get IDE instance and start session
    const ide = IDEFactory.getIDE(ideType);
    const ideSession = await ide.start(config);

    // Store session
    const sessionStore = getSessionStore();
    sessionStore.set(ideSession.id, ideSession);

    return NextResponse.json({
      success: true,
      session: {
        id: ideSession.id,
        type: ideSession.type,
        url: ideSession.url,
        status: ideSession.status,
        workspaceId: ideSession.workspaceId,
        createdAt: ideSession.createdAt,
      },
    });
  } catch (error) {
    console.error('Failed to create IDE session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create IDE session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
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

  try {
    // Authentication check
    const authSession = await getServerSession(authOptions);
    if (!authSession?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required to list IDE sessions' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') as IDEType | null;

    const sessionStore = getSessionStore();
    let filteredSessions = sessionStore.list();

    // Only allow users to see their own sessions unless they are admin
    if (authSession.user.role !== 'admin') {
      filteredSessions = filteredSessions.filter((s) => s.userId === authSession.user!.id);
    }

    // Filter by workspaceId if provided
    if (workspaceId) {
      filteredSessions = filteredSessions.filter(
        (s) => s.workspaceId === workspaceId
      );
    }

    // Filter by userId if provided
    if (userId) {
      filteredSessions = filteredSessions.filter((s) => s.userId === userId);
    }

    // Filter by type if provided
    if (type) {
      filteredSessions = filteredSessions.filter((s) => s.type === type);
    }

    return NextResponse.json({
      success: true,
      sessions: filteredSessions.map((s) => ({
        id: s.id,
        type: s.type,
        url: s.url,
        status: s.status,
        workspaceId: s.workspaceId,
        userId: s.userId,
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
      })),
    });
  } catch (error) {
    console.error('Failed to list IDE sessions:', error);
    return NextResponse.json(
      { error: 'Failed to list IDE sessions' },
      { status: 500 }
    );
  }
}
