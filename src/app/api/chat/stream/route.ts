/**
 * Chat Streaming API Endpoint
 * Provides AI chat with Server-Sent Events streaming via OpenRouter
 *
 * Requires OPENROUTER_API_KEY to be configured.
 * For full RAG-enabled streaming, see /api/ai/chat/stream
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(30)

export async function POST(request: NextRequest) {
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

    const apiKey = process.env.OPENROUTER_API_KEY
    const apiBase = process.env.OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1'

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'AI service not configured',
          message: 'Configure OPENROUTER_API_KEY environment variable to enable chat streaming',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { message, model, messages: inputMessages } = body

    if (!message && !inputMessages) {
      return NextResponse.json(
        { error: 'Missing required field: message' },
        { status: 400 }
      )
    }

    const chatMessages = inputMessages || [
      { role: 'user', content: message },
    ]

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'anthropic/claude-sonnet-4-20250514',
        messages: chatMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4000,
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

    // Forward the SSE stream from OpenRouter
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const reader = response.body?.getReader()

    if (!reader) {
      return NextResponse.json(
        { error: 'Failed to read AI response stream' },
        { status: 500 }
      )
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let buffer = ''
          let tokenCount = 0
          let chunkCount = 0
          const startTime = Date.now()

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') {
                  const elapsedMs = Date.now() - startTime

                  // Emit final metadata before done event
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: 'metadata',
                        tokenCount,
                        chunkCount,
                        elapsedMs,
                        tokensPerSecond: elapsedMs > 0 ? (tokenCount / (elapsedMs / 1000)).toFixed(2) : 0,
                        timestamp: new Date().toISOString(),
                      })}\n\n`
                    )
                  )

                  controller.enqueue(encoder.encode(`data: {"type": "done", "done": true}\n\n`))
                  continue
                }
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content || ''
                  const usage = parsed.usage

                  if (content) {
                    // Approximate token count (rough estimate: ~4 chars per token)
                    tokenCount += Math.ceil(content.length / 4)
                    chunkCount++

                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: 'content',
                          content,
                          timestamp: new Date().toISOString(),
                        })}\n\n`
                      )
                    )

                    // Emit metadata every 10 chunks
                    if (chunkCount % 10 === 0) {
                      const elapsedMs = Date.now() - startTime
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: 'metadata',
                            tokenCount,
                            chunkCount,
                            elapsedMs,
                            tokensPerSecond: elapsedMs > 0 ? (tokenCount / (elapsedMs / 1000)).toFixed(2) : 0,
                            timestamp: new Date().toISOString(),
                          })}\n\n`
                        )
                      )
                    }
                  }

                  // If OpenRouter provides usage stats, use them
                  if (usage?.total_tokens) {
                    tokenCount = usage.total_tokens
                  }
                } catch {
                  // Skip malformed SSE chunks
                }
              }
            }
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to process chat request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
