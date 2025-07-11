/**
 * Claude Code Chat API Route
 * 
 * API endpoint for Claude Code CLI chat integration
 * Handles terminal-based Claude Code commands through web interface
 * 
 * Staff Engineer Implementation - Production-ready Claude CLI API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getClaudeCliInstance } from '@/lib/claude-cli-integration'
import type { ClaudeCliRequest } from '@/lib/claude-cli-integration'

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

    // Parse request body
    const body = await request.json()
    const { message, workspaceId, contextFiles, sessionId } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

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

    // Execute chat command
    const response = await claudeCli.chatWithClaude(message, contextFiles)

    return NextResponse.json({
      success: response.success,
      message: response.output,
      error: response.error,
      metadata: response.metadata
    })

  } catch (error) {
    console.error('Claude chat API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}