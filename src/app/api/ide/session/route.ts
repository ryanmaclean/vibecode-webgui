/**
 * IDE Session API - Unified endpoint for all IDE types
 * POST /api/ide/session - Create new IDE session
 * GET /api/ide/session - List all sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { IDEFactory, IDEConfig, IDEType } from '@/lib/ide';
import { getSessionStore } from '@/lib/ide/session/store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, userId, type, projectPath, extensions, auth, port } = body;

    // Validate required fields
    if (!workspaceId || !userId) {
      return NextResponse.json(
        { error: 'workspaceId and userId are required' },
        { status: 400 }
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
    const session = await ide.start(config);

    // Store session
    const sessionStore = getSessionStore();
    sessionStore.set(session.id, session);

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        type: session.type,
        url: session.url,
        status: session.status,
        workspaceId: session.workspaceId,
        createdAt: session.createdAt,
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
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') as IDEType | null;

    const sessionStore = getSessionStore();
    let filteredSessions = sessionStore.list();

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
