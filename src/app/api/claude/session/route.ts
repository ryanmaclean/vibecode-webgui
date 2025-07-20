/**
 * Claude Code Session API Route
 *
 * API endpoint for managing Claude Code CLI interactive sessions
 * Handles terminal-based Claude Code session management
 *
 * Staff Engineer Implementation - Production-ready Claude CLI API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getClaudeCliInstance } from '@/lib/claude-cli-integration'

// Store active sessions (in production, use Redis or database)
const activeSessions = new Map<string, string>()

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, workspaceId, sessionId, message } = body

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Get workspace directory
    const workspaceDir = `/workspaces/${workspaceId}`

    // Initialize Claude CLI
    const claudeCli = getClaudeCliInstance({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      workingDirectory: workspaceDir,
      timeout: 60000 // 60 seconds
    })

    switch (action) {
      case 'start':
        try {
          const newSessionId = await claudeCli.startInteractiveSession()
          activeSessions.set(`${session.user.id}-${workspaceId}`, newSessionId)

          return NextResponse.json({
            success: true,
            sessionId: newSessionId,
            message: 'Interactive Claude session started'
          })
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to start session'
          }, { status: 500 })
        }

      case 'send':
        if (!sessionId || !message) {
          return NextResponse.json(
            { error: 'Session ID and message are required for send action' },
            { status: 400 }
          )
        }

        try {
          await claudeCli.sendToSession(sessionId, message)

          return NextResponse.json({
            success: true,
            message: 'Message sent to Claude session'
          })
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send message'
          }, { status: 500 })
        }

      case 'close':
        if (!sessionId) {
          return NextResponse.json(
            { error: 'Session ID is required for close action' },
            { status: 400 }
          )
        }

        try {
          await claudeCli.closeSession(sessionId)
          activeSessions.delete(`${session.user.id}-${workspaceId}`)

          return NextResponse.json({
            success: true,
            message: 'Claude session closed'
          })
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to close session'
          }, { status: 500 })
        }

      case 'status':
        const userSessionKey = `${session.user.id}-${workspaceId}`
        const activeSessionId = activeSessions.get(userSessionKey)

        return NextResponse.json({
          success: true,
          hasActiveSession: !!activeSessionId,
          sessionId: activeSessionId || null
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be one of: start, send, close, status' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Claude session API error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Check session status
    const userSessionKey = `${session.user.id}-${workspaceId}`
    const activeSessionId = activeSessions.get(userSessionKey)

    return NextResponse.json({
      success: true,
      hasActiveSession: !!activeSessionId,
      sessionId: activeSessionId || null,
      totalActiveSessions: activeSessions.size
    })

  } catch (error) {
    console.error('Claude session status API error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
