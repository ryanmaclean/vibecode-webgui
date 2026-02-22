// Ollama Chat Streaming API - Local AI chat with real-time streaming responses
// Provides streaming chat completions using locally-hosted Ollama models

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ollamaClient } from '@/lib/ollama-client'
import type { OllamaChatMessage } from '@/lib/ollama-client'
import { z } from '@/lib/zod-compat'
import { validateRequestBody } from '@/lib/api/validation/middleware'
import { logger } from '@/lib/logger'
import type { AuthenticatedRequest } from '@/lib/auth/middleware'
import { createAPIRateLimit } from '@/lib/rate-limiting'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

// Rate limiter: 30 requests per minute for AI endpoints (more restrictive)
const apiRateLimit = createAPIRateLimit(30)

/**
 * Get allowed origins from environment or use defaults
 */
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
  }
  // Default allowed origins for streaming chat
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

// Zod validation schema for Ollama chat requests
const ASCII_CONTROL_PATTERN = '^[^\\u0000-\\u001F\\u007F]*$'
const asciiControlRegex = new RegExp(ASCII_CONTROL_PATTERN, 'u')

const ollamaChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z
      .string()
      .min(1)
      .max(4000)
      .regex(asciiControlRegex, 'Message contains invalid characters')
  })).min(1).max(50),
  model: z.string().min(1).max(100),
  options: z.object({
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    top_k: z.number().min(0).optional(),
    num_ctx: z.number().positive().optional(),
    num_predict: z.number().positive().optional(),
    repeat_penalty: z.number().min(0).optional(),
    stop: z.array(z.string()).optional()
  }).optional()
})

export async function POST(req: AuthenticatedRequest & NextRequest) {
  try {
    // Check rate limit
    const rateLimitResult = await apiRateLimit(req)
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

    const session = (await getServerSession(authOptions)) as { user?: { id?: string } } | null
    if (!session?.user?.id) {
      logger.warn('Ollama chat unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if Ollama is available
    const isAvailable = await ollamaClient.isAvailable()
    if (!isAvailable) {
      logger.warn('Ollama chat request but Ollama not available')
      return NextResponse.json(
        {
          error: 'Ollama is not running',
          details: 'Please start Ollama service or install it from https://ollama.ai'
        },
        { status: 503 }
      )
    }

    // Validate request body
    const validation = await validateRequestBody(req, ollamaChatRequestSchema)
    if (!validation.success) {
      logger.warn('Ollama chat validation failed', {
        errors: validation.error,
      })
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error },
        { status: 400 }
      )
    }

    const { messages, model, options } = validation.data as z.infer<typeof ollamaChatRequestSchema>

    // Set up Server-Sent Events headers
    const { ReadableStream, TextEncoder, Response: GlobalResponse } = globalThis
    const encoder = new TextEncoder()
    const customReadable = new ReadableStream({
      async start(controller) {
        try {
          // Create the chat stream request
          const chatMessages: OllamaChatMessage[] = messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))

          const stream = ollamaClient.chatStream({
            model,
            messages: chatMessages,
            stream: true,
            options
          })

          // Stream the response chunks
          for await (const chunk of stream) {
            const content = chunk.message?.content || ''

            if (content) {
              const data = JSON.stringify({
                content,
                model,
                timestamp: new Date().toISOString(),
                done: chunk.done || false
              })

              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }

            // Check if stream is complete
            if (chunk.done) {
              // Send completion signal with stats
              const completionData = JSON.stringify({
                done: true,
                model,
                stats: {
                  total_duration: chunk.total_duration,
                  load_duration: chunk.load_duration,
                  prompt_eval_count: chunk.prompt_eval_count,
                  prompt_eval_duration: chunk.prompt_eval_duration,
                  eval_count: chunk.eval_count,
                  eval_duration: chunk.eval_duration
                }
              })
              controller.enqueue(encoder.encode(`data: ${completionData}\n\n`))
              break
            }
          }

          controller.close()
        } catch (error) {
          logger.error('Ollama chat SSE error', {
            error: error instanceof Error ? error.message : error,
            model,
          })

          // Send error event
          const errorData = JSON.stringify({
            error: 'Stream processing failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.close()
        }
      }
    })

    // Get and validate CORS origin
    const requestOrigin = req.headers.get('origin')
    const validatedOrigin = getValidatedCorsOrigin(requestOrigin)

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    // Only set Access-Control-Allow-Origin if the origin is validated
    if (validatedOrigin) {
      responseHeaders['Access-Control-Allow-Origin'] = validatedOrigin
      responseHeaders['Vary'] = 'Origin'
    }

    return new GlobalResponse(customReadable, {
      headers: responseHeaders
    })

  } catch (error) {
    logger.error('Ollama chat request failed', {
      error: error instanceof Error ? error.message : error,
    })

    return NextResponse.json(
      {
        error: 'Failed to process Ollama chat request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  const { Response: GlobalResponse } = globalThis
  const requestOrigin = request.headers.get('origin')
  const validatedOrigin = getValidatedCorsOrigin(requestOrigin)

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  // Only set Access-Control-Allow-Origin if the origin is validated
  if (validatedOrigin) {
    headers['Access-Control-Allow-Origin'] = validatedOrigin
    headers['Vary'] = 'Origin'
  }

  return new GlobalResponse(null, {
    status: 200,
    headers,
  })
}
