/**
 * AI Project Generation API Endpoint
 * Generates project scaffolding using AI via OpenRouter
 *
 * Requires OPENROUTER_API_KEY to be configured.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const generateProjectSchema = z.object({
  prompt: z.string().min(1, 'Project prompt is required').max(4000),
})

const apiRateLimit = createAPIRateLimit(10)

export async function POST(request: NextRequest) {
  // Authentication check
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
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

    const body = await request.json()
    const validation = generateProjectSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    const apiBase = process.env.OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1'

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'AI service not configured',
          message: 'Configure OPENROUTER_API_KEY environment variable to enable project generation',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      )
    }

    const { prompt } = validation.data

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [
          {
            role: 'system',
            content:
              'You are a project scaffolding assistant. Given a project description, generate a JSON project structure with: name, description, files (array of {path, content}), scripts (object of npm scripts), dependencies (object), devDependencies (object), and envVars (array of {name, description, required}). Respond with valid JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        {
          error: 'AI provider request failed',
          message: `OpenRouter returned ${response.status}`,
          details: errorText,
        },
        { status: response.status }
      )
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content || ''

    let project
    try {
      project = JSON.parse(content)
    } catch {
      project = {
        name: 'generated-project',
        description: prompt,
        rawResponse: content,
        files: [],
        scripts: {},
        dependencies: {},
        devDependencies: {},
        envVars: [],
      }
    }

    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      project,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to generate project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
