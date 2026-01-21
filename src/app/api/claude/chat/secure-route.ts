/**
 * Secure Claude Code Chat API Route
 *
 * Security-hardened API endpoint using the secure CLI integration
 * Implements proper input validation, authentication, and rate limiting
 *
 * Staff Engineer Implementation - Production-ready secure Claude API
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { getServerSession } from 'next-auth'
import { getSecureClaudeCliInstance } from '@/lib/claude-cli-integration-secure'
import type { SecureClaudeCliConfig } from '@/lib/claude-cli-integration-secure'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import { hasWorkspaceAccess as checkWorkspaceAccess } from '@/lib/auth/workspace-access'

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await apiRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
          },
        }
      )
    }

    // Authenticate user
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const { message, workspaceId, contextFiles, sessionId } = body

    // Input validation
    const validationErrors = validateChatRequest({
      message,
      workspaceId,
      contextFiles,
      sessionId
    })

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationErrors
        },
        { status: 400 }
      )
    }

    // Validate workspace access
    if (!await hasWorkspaceAccess(session.user.id, workspaceId)) {
      return NextResponse.json(
        { error: 'Access denied to workspace' },
        { status: 403 }
      )
    }

    // Initialize secure Claude CLI
    const config: SecureClaudeCliConfig = {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      workingDirectory: `/workspaces/${workspaceId}`,
      timeout: 30000,
      maxConcurrentProcesses: 3,
      userId: session.user.id,
      sessionId: sessionId || crypto.randomUUID(),
      maxTokens: 4096,
      temperature: 0.1
    }

    const claudeCli = getSecureClaudeCliInstance(config)

    // Execute secure chat command
    const response = await claudeCli.executeCommand({
      command: 'chat',
      input: message,
      files: contextFiles ? validateAndSanitizeFiles(contextFiles) : undefined,
      context: `User: ${session.user.id}, Workspace: ${workspaceId}`
    })

    // Add security headers
    const headers = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    }

    return NextResponse.json({
      success: response.success,
      message: response.output,
      error: response.error,
      metadata: {
        ...response.metadata,
        userId: session.user.id,
        workspaceId,
        timestamp: new Date().toISOString()
      }
    }, { headers })

  } catch (error) {
    // Server error logged

    // Don't expose internal errors
    return NextResponse.json(
      {
        error: 'Service temporarily unavailable',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

/**
 * Validate chat request parameters
 */
function validateChatRequest(params: any): string[] {
  const errors: string[] = []

  // Validate message
  if (!params?.message) {
    errors.push('Message is required')
  } else if (typeof params.message !== 'string') {
    errors.push('Message must be a string')
  } else if (params.message.length > 10000) {
    errors.push('Message exceeds maximum length (10,000 characters)')
  } else if (params.message.trim().length === 0) {
    errors.push('Message cannot be empty')
  }

  // Validate workspaceId
  if (!params?.workspaceId) {
    errors.push('Workspace ID is required')
  } else if (typeof params.workspaceId !== 'string') {
    errors.push('Workspace ID must be a string')
  } else if (!/^[a-zA-Z0-9_-]+$/.test(params.workspaceId)) {
    errors.push('Workspace ID contains invalid characters')
  } else if (params.workspaceId.length > 50) {
    errors.push('Workspace ID exceeds maximum length')
  }

  // Validate contextFiles (optional)
  if (params.contextFiles !== undefined) {
    if (!Array.isArray(params.contextFiles)) {
      errors.push('Context files must be an array')
    } else if (params.contextFiles.length > 10) {
      errors.push('Too many context files (maximum 10)')
    } else {
      params.contextFiles.forEach((file: unknown, index: number) => {
        if (typeof file !== 'string') {
          errors.push(`Context file ${index} must be a string`)
        } else if (file.length > 255) {
          errors.push(`Context file ${index} path too long`)
        }
      })
    }
  }

  // Validate sessionId (optional)
  if (params.sessionId !== undefined) {
    if (typeof params.sessionId !== 'string') {
      errors.push('Session ID must be a string')
    } else if (!/^[a-zA-Z0-9_-]+$/.test(params.sessionId)) {
      errors.push('Session ID contains invalid characters')
    } else if (params.sessionId.length > 100) {
      errors.push('Session ID exceeds maximum length')
    }
  }

  return errors
}

/**
 * Validate and sanitize file paths
 */
function validateAndSanitizeFiles(files: string[]): string[] {
  const allowedExtensions = ['.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt', '.css', '.html']
  const blockedPaths = ['..', '/etc', '/usr', '/var', 'node_modules', '.git']

  return files
    .filter(file => {
      // Basic validation
      if (!file || typeof file !== 'string' || file.length > 255) {
        return false
      }

      // Check for blocked patterns
      if (blockedPaths.some(blocked => file.includes(blocked))) {
        return false
      }

      // Check extension
      const ext = path.extname(file).toLowerCase()
      if (ext && !allowedExtensions.includes(ext)) {
        return false
      }

      return true
    })
    .map(file => {
      // Normalize path
      return path.normalize(file).replace(/^\/+/, '')
    })
    .slice(0, 10) // Limit to 10 files
}

/**
 * Validate user access to workspace
 * Uses the workspace-access module for proper database-backed authorization
 */
async function hasWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  // Basic input validation
  if (!userId || !workspaceId) {
    return false
  }

  // Format validation to prevent injection
  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId) || workspaceId.length > 50) {
    return false
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(userId) || userId.length > 50) {
    return false
  }

  try {
    // Convert userId to number for the workspace access check
    // The workspace-access module expects numeric user IDs from the database
    const userIdNum = parseInt(userId, 10)

    // If userId is not a valid number, deny access
    // Passing 0 as userId would be a security issue - deny access instead
    if (isNaN(userIdNum) || userIdNum <= 0) {
      console.warn('Invalid numeric userId for workspace access check:', userId)
      return false
    }

    // Use the proper workspace access check with database validation
    // This checks the workspace_members table for active membership
    return await checkWorkspaceAccess(userIdNum, workspaceId)
  } catch (error) {
    // Log error but fail closed (deny access) for security
    console.error('Workspace access validation error:', error)
    return false
  }
}

export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || 'https://vibecode.dev',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '3600',
    },
  })
}
