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
import { z } from 'zod'

// Security: Input validation schema
const ClaudeChatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
  workspaceId: z.string()
    .min(1, 'Workspace ID required')
    .max(100, 'Workspace ID too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid workspace ID format'),
  contextFiles: z.array(z.string()).optional().default([])
    .refine((files) => files.every(f => !f.includes('..')), {
      message: 'Path traversal detected in context files'
    })
})

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

    // Parse and validate request body
    const body = await request.json()
    const validationResult = ClaudeChatRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      )
    }

    const { message, workspaceId, contextFiles } = validationResult.data

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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
