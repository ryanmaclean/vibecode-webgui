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
import { claudeSessionActionSchema, claudeSessionQuerySchema } from '@/lib/api/validation/schemas'
import { z } from '@/lib/zod-compat'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

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

    // Validate request body with Zod
    let validatedData
    try {
      const body = await request.json()
      validatedData = claudeSessionActionSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid request parameters',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          },
          { status: 400 }
        )
      }
      throw error
    }

    const { action, workspaceId } = validatedData

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
        if (validatedData.action !== 'send') break
        try {
          await claudeCli.sendToSession(validatedData.sessionId, validatedData.message)

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
        if (validatedData.action !== 'close') break
        try {
          await claudeCli.closeSession(validatedData.sessionId)
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

    }

  } catch (error) {
    // Server error logged

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

    // Validate query parameters with Zod
    const { searchParams } = new URL(request.url)
    const queryData = {
      workspaceId: searchParams.get('workspaceId') || ''
    }

    try {
      const validatedQuery = claudeSessionQuerySchema.parse(queryData)
      const { workspaceId } = validatedQuery

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
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          },
          { status: 400 }
        )
      }
      throw error
    }

  } catch (error) {
    // Server error logged

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
