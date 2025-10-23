/**
 * Individual code-server session management API
 * Handles session status, updates, and cleanup
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { validatePathParams, validateRequestBody } from '@/lib/api/validation/middleware'
import { codeServerSessionIdSchema, codeServerSessionUpdateSchema } from '@/lib/api/validation/schemas-phase4-batch2'
// Local implementation of container stopping
async function stopCodeServerContainer(containerId: string): Promise<void> {
  // Debug log removed
  // Simulate container stopping - replace with actual Docker API call
  await new Promise(resolve => setTimeout(resolve, 500))
}

interface CodeServerInstance {
  id: string
  url: string
  status: 'starting' | 'ready' | 'error' | 'stopped'
  workspaceId: string
  userId: string
  containerId?: string
  createdAt: Date
  lastActivity: Date
}

// In-memory storage for development (replace with Redis/database in production)
const activeSessions = new Map<string, CodeServerInstance>()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Validate path parameters
    const validation = validatePathParams(resolvedParams, codeServerSessionIdSchema)
    if (!validation.success) {
      return validation.error as NextResponse
    }

    const { sessionId } = validation.data
    const codeServerSession = activeSessions.get(sessionId)

    if (!codeServerSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (codeServerSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update last activity
    codeServerSession.lastActivity = new Date()

    return NextResponse.json(codeServerSession)
  } catch (error) {
    // Server error logged
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Validate path parameters
    const validation = validatePathParams(resolvedParams, codeServerSessionIdSchema)
    if (!validation.success) {
      return validation.error as NextResponse
    }

    const { sessionId } = validation.data
    const codeServerSession = activeSessions.get(sessionId)

    if (!codeServerSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (codeServerSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Stop the container if it exists
    if (codeServerSession.containerId) {
      try {
        await stopCodeServerContainer(codeServerSession.containerId)
      } catch (error) {
        // Server error logged
      }
    }

    // Mark session as stopped
    codeServerSession.status = 'stopped'

    // Remove from active sessions after a short delay
    setTimeout(() => {
      activeSessions.delete(sessionId)
    }, 5000)

    return NextResponse.json({ message: 'Session stopped successfully' })
  } catch (error) {
    // Server error logged
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params

    // Validate path parameters
    const paramValidation = validatePathParams(resolvedParams, codeServerSessionIdSchema)
    if (!paramValidation.success) {
      return paramValidation.error as NextResponse
    }

    const { sessionId } = paramValidation.data
    const codeServerSession = activeSessions.get(sessionId)

    if (!codeServerSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (codeServerSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate request body
    const bodyValidation = await validateRequestBody(request, codeServerSessionUpdateSchema)
    if (!bodyValidation.success) {
      return bodyValidation.error as NextResponse
    }

    const body = bodyValidation.data

    // Update session properties
    if (body.status) {
      codeServerSession.status = body.status
    }

    codeServerSession.lastActivity = new Date()

    return NextResponse.json(codeServerSession)
  } catch (error) {
    // Server error logged
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
