/**
 * Claude Code Analyze API Route
 *
 * API endpoint for Claude Code CLI code analysis
 * Handles terminal-based Claude Code analysis commands
 *
 * Staff Engineer Implementation - Production-ready Claude CLI API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getClaudeCliInstance } from '@/lib/claude-cli-integration'

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
    const { code, language, workspaceId, analysisType = 'analyze' } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      )
    }

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Validate analysis type
    const validTypes = ['analyze', 'explain', 'optimize', 'debug', 'test']
    if (!validTypes.includes(analysisType)) {
      return NextResponse.json(
        { error: `Invalid analysis type. Must be one of: ${validTypes.join(', ')}` },
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

    // Execute appropriate analysis command
    let response
    switch (analysisType) {
      case 'analyze':
        response = await claudeCli.analyzeCode(code, language)
        break
      case 'explain':
        response = await claudeCli.explainCode(code, language)
        break
      case 'optimize':
        response = await claudeCli.optimizeCode(code, language)
        break
      case 'debug':
        response = await claudeCli.debugCode(code)
        break
      case 'test':
        response = await claudeCli.generateTests(code, language)
        break
      default:
        response = await claudeCli.analyzeCode(code, language)
    }

    return NextResponse.json({
      success: response.success,
      analysis: response.output,
      error: response.error,
      metadata: response.metadata,
      type: analysisType
    })

  } catch (error) {
    console.error('Claude analyze API error:', error)

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
