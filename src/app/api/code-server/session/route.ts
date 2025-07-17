/**
 * Code-server session management API
 * Handles creation and management of code-server instances
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const createSessionSchema = z.object({
  workspaceId: z.string().min(1),
  projectPath: z.string().default('/workspace'),
  userId: z.string().min(1),
})

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

function generateSessionId(): string {
  return `cs-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

async function startCodeServerContainer(workspaceId: string): Promise<{
  containerId: string
  url: string
}> {
  // For development, simulate container creation
  // In production, this would interact with Docker/Kubernetes API

  const containerId = `code-server-${workspaceId}-${Date.now()}`
  const port = 8080 + Math.floor(Math.random() * 1000) // Random port for demo
  const url = `http://localhost:${port}`

  // Simulate container startup delay
  await new Promise(resolve => setTimeout(resolve, 2000))

  return { containerId, url }
}

async function stopCodeServerContainer(containerId: string): Promise<void> {
  // Simulate container cleanup
  console.log(`Stopping container: ${containerId}`)
  await new Promise(resolve => setTimeout(resolve, 500))
}

// Export for use in other files
export { stopCodeServerContainer }

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspaceId, userId } = createSessionSchema.parse(body)

    // Verify user owns the workspace (add proper authorization logic)
    if (session.user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check for existing session
    const existingSession = Array.from(activeSessions.values()).find(
      s => s.workspaceId === workspaceId && s.userId === userId && s.status !== 'stopped'
    )

    if (existingSession) {
      return NextResponse.json(existingSession)
    }

    // Create new session
    const sessionId = generateSessionId()
    const newSession: CodeServerInstance = {
      id: sessionId,
      url: '', // Will be set after container starts
      status: 'starting',
      workspaceId,
      userId,
      createdAt: new Date(),
      lastActivity: new Date(),
    }

    activeSessions.set(sessionId, newSession)

    // Start code-server container in background
    startCodeServerContainer(workspaceId)
      .then(({ containerId, url }) => {
        const session = activeSessions.get(sessionId)
        if (session) {
          session.containerId = containerId
          session.url = url
          session.status = 'ready'
          session.lastActivity = new Date()
        }
      })
      .catch(error => {
        console.error('Failed to start code-server container:', error)
        const session = activeSessions.get(sessionId)
        if (session) {
          session.status = 'error'
        }
      })

    return NextResponse.json(newSession)
  } catch (error) {
    console.error('Code-server session creation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    let sessions = Array.from(activeSessions.values()).filter(
      s => s.userId === session.user.id
    )

    if (workspaceId) {
      sessions = sessions.filter(s => s.workspaceId === workspaceId)
    }

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Code-server session list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
