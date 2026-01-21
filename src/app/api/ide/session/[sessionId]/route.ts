/**
 * IDE Session API - Individual session operations
 * GET /api/ide/session/[sessionId] - Get session details
 * DELETE /api/ide/session/[sessionId] - Stop and delete session
 * PATCH /api/ide/session/[sessionId] - Update session (e.g., install extension)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { IDEFactory } from '@/lib/ide';
import { getSessionStore } from '@/lib/ide/session/store';

interface RouteContext {
  params: Promise<{
    sessionId: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Authentication check
    const authSession = await getServerSession(authOptions);
    if (!authSession?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required to access IDE session' },
        { status: 401 }
      );
    }

    const { sessionId } = await context.params;

    const sessions = getSessionStore();
    const session = sessions.get(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Authorization check - users can only access their own sessions unless admin
    if (authSession.user.role !== 'admin' && session.userId !== authSession.user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this IDE session' },
        { status: 403 }
      );
    }

    // Get IDE instance and perform health check
    const ide = IDEFactory.getIDE(session.type);
    const health = await ide.healthCheck(sessionId);

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        type: session.type,
        url: session.url,
        status: session.status,
        workspaceId: session.workspaceId,
        userId: session.userId,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        health,
      },
    });
  } catch (error) {
    console.error('Failed to get IDE session:', error);
    return NextResponse.json(
      { error: 'Failed to get IDE session' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Authentication check
    const authSession = await getServerSession(authOptions);
    if (!authSession?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required to delete IDE session' },
        { status: 401 }
      );
    }

    const { sessionId } = await context.params;

    const sessionStore = getSessionStore();
    const session = sessionStore.get(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Authorization check - users can only delete their own sessions unless admin
    if (authSession.user.role !== 'admin' && session.userId !== authSession.user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to delete this IDE session' },
        { status: 403 }
      );
    }

    // Get IDE instance and stop session
    const ide = IDEFactory.getIDE(session.type);
    await ide.stop(sessionId);

    // Remove from session store
    sessionStore.delete(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session stopped successfully',
    });
  } catch (error) {
    console.error('Failed to stop IDE session:', error);
    return NextResponse.json(
      { error: 'Failed to stop IDE session' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Authentication check
    const authSession = await getServerSession(authOptions);
    if (!authSession?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required to update IDE session' },
        { status: 401 }
      );
    }

    const { sessionId } = await context.params;
    const body = await request.json();
    const { action, extensionId } = body;

    const sessionStore = getSessionStore();
    const session = sessionStore.get(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Authorization check - users can only update their own sessions unless admin
    if (authSession.user.role !== 'admin' && session.userId !== authSession.user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to update this IDE session' },
        { status: 403 }
      );
    }

    const ide = IDEFactory.getIDE(session.type);

    // Handle different actions
    if (action === 'install-extension') {
      if (!extensionId) {
        return NextResponse.json(
          { error: 'extensionId is required' },
          { status: 400 }
        );
      }

      if (ide.installExtension) {
        await ide.installExtension(sessionId, extensionId);
        return NextResponse.json({
          success: true,
          message: `Extension ${extensionId} installed`,
        });
      } else {
        return NextResponse.json(
          { error: 'IDE does not support extension installation' },
          { status: 400 }
        );
      }
    }

    if (action === 'list-extensions') {
      if (ide.listExtensions) {
        const extensions = await ide.listExtensions(sessionId);
        return NextResponse.json({
          success: true,
          extensions,
        });
      } else {
        return NextResponse.json(
          { error: 'IDE does not support extension listing' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to update IDE session:', error);
    return NextResponse.json(
      { error: 'Failed to update IDE session' },
      { status: 500 }
    );
  }
}
