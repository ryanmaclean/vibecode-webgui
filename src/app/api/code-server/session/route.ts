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
  userId: z.string().min(1).optional(),
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

async function startCodeServerContainer(workspaceId: string, userId: string): Promise<{
  containerId: string
  url: string
}> {
  // Real Kubernetes deployment
  const { spawn } = require('child_process')
  const path = require('path')
  
  const scriptPath = path.join(process.cwd(), 'scripts', 'create-workspace.sh')
  
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [scriptPath, workspaceId, userId], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    let stdout = ''
    let stderr = ''
    
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })
    
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })
    
    child.on('close', (code) => {
      if (code === 0) {
        // Parse the output to get service details
        const serviceName = `code-server-${workspaceId}-svc`
        const internalUrl = `http://${serviceName}.vibecode.svc.cluster.local:8080`
        
        // Set up port forwarding for external access
        const portNumber = 8080 + Math.floor(Math.random() * 1000) // Random port for dev
        const externalUrl = `http://localhost:${portNumber}`
        
        // Start port forwarding in background
        const portForwardCmd = spawn('kubectl', [
          'port-forward', '-n', 'vibecode',
          `deployment/code-server-${workspaceId}`,
          `${portNumber}:8080`
        ], { detached: true, stdio: 'ignore' })
        
        portForwardCmd.unref()
        
        resolve({
          containerId: `code-server-${workspaceId}`,
          url: externalUrl
        })
      } else {
        console.error('Workspace creation failed:', stderr)
        reject(new Error(`Failed to create workspace: ${stderr}`))
      }
    })
    
    child.on('error', (error) => {
      console.error('Script execution error:', error)
      reject(error)
    })
  })
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

    // Verify user owns the workspace - use session user ID if no userId provided
    const effectiveUserId = userId || session.user.id
    if (session.user.id !== effectiveUserId && userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check for existing session
    const existingSession = Array.from(activeSessions.values()).find(
      s => s.workspaceId === workspaceId && s.userId === effectiveUserId && s.status !== 'stopped'
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
      userId: effectiveUserId,
      createdAt: new Date(),
      lastActivity: new Date(),
    }

    activeSessions.set(sessionId, newSession)

    // Start code-server container in background
    startCodeServerContainer(workspaceId, effectiveUserId)
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
