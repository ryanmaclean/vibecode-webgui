/**
 * Claude Code Generate API Route
 *
 * API endpoint for Claude Code CLI code generation
 * Handles terminal-based Claude Code generation commands
 *
 * Staff Engineer Implementation - Production-ready Claude CLI API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getClaudeCliInstance } from '@/lib/claude-cli-integration'
import { z } from '@/lib/zod-compat'

// Security: Input validation schema
const ClaudeGenerateRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty').max(5000, 'Prompt too long'),
  workspaceId: z.string()
    .min(1, 'Workspace ID required')
    .max(100, 'Workspace ID too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid workspace ID format'),
  filePath: z.string()
    .optional()
    .refine((path) => !path || !path.includes('..'), {
      message: 'Path traversal detected'
    })
    .refine((path) => !path || path.length <= 500, {
      message: 'File path too long'
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
    const validationResult = ClaudeGenerateRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      )
    }

    const { prompt, workspaceId, filePath } = validationResult.data

    // Get workspace directory
    const workspaceDir = `/workspaces/${workspaceId}`

    // Initialize Claude CLI
    const claudeCli = getClaudeCliInstance({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      workingDirectory: workspaceDir,
      timeout: 60000 // 60 seconds
    })

    // Execute generate command
    const response = await claudeCli.generateCode(prompt, filePath)

    return NextResponse.json({
      success: response.success,
      code: response.output,
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

/**
 * Get allowed origins from environment or use defaults
 */
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
  }
  // Default allowed origins for Claude generate endpoint
  return [
    'https://vibecode.dev',
    'http://localhost:3000',
    'http://localhost:8080'
  ]
}

/**
 * Validate and return CORS origin if allowed
 */
function getValidatedCorsOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) {
    return null
  }

  const allowedOrigins = getAllowedOrigins()

  // Check if the request origin is in the allowed list
  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin
  }

  return null
}

export async function OPTIONS(request: NextRequest) {
  const requestOrigin = request.headers.get('origin')
  const validatedOrigin = getValidatedCorsOrigin(requestOrigin)

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '3600',
  }

  // Only set Access-Control-Allow-Origin if the origin is validated
  if (validatedOrigin) {
    headers['Access-Control-Allow-Origin'] = validatedOrigin
    headers['Vary'] = 'Origin'
  }

  return new NextResponse(null, {
    status: 200,
    headers,
  })
}
