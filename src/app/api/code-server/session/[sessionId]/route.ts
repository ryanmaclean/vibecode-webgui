/**
 * Individual code-server session management API
 * Handles session status, updates, and cleanup
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stopCodeServerContainer } from '../route'

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
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = params.sessionId
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
    console.error('Code-server session get error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = params.sessionId
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
        console.error('Failed to stop container:', error)
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
    console.error('Code-server session delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = params.sessionId
    const codeServerSession = activeSessions.get(sessionId)

    if (!codeServerSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (codeServerSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // Update session properties
    if (body.status && ['starting', 'ready', 'error', 'stopped'].includes(body.status)) {
      codeServerSession.status = body.status
    }

    codeServerSession.lastActivity = new Date()

    return NextResponse.json(codeServerSession)
  } catch (error) {
    console.error('Code-server session update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
