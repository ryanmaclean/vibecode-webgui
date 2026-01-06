// Streaming AI Chat API - OpenRouter integration with multi-model support and RAG
// Powers the AIChatInterface with real-time streaming responses and vector search context

import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { vectorStore } from '@/lib/vector-store'
import { prisma } from '@/lib/prisma'
import { z } from '@/lib/zod-compat'
import { validateRequestBody } from '@/lib/api/validation/middleware'
import { logger } from '@/lib/logger'
import type { AuthenticatedRequest } from '@/lib/auth/middleware'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'


interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Zod validation schema for streaming chat requests
const ASCII_CONTROL_PATTERN = '^[^\\u0000-\\u001F\\u007F]*$'
const asciiControlRegex = new RegExp(ASCII_CONTROL_PATTERN, 'u')

const streamingChatRequestSchema = z.object({
  message: z
    .string()
    .min(1)
    .max(4000)
    .regex(asciiControlRegex, 'Message contains invalid characters'),
  model: z.string().min(1).max(100),
  context: z.object({
    workspaceId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid workspace ID format'),
    files: z.array(z.string().max(500)).max(20),
    previousMessages: z.array(z.object({
      type: z.enum(['user', 'assistant']),
      content: z.string().max(4000)
    })).max(50)
  })
})

// Helper to build RAG context from workspace using vector search
async function buildRAGContext(workspaceId: string, userQuery: string, userId: string) {
  try {
    // Get workspace from database
    const workspace = await prisma.workspace.findFirst({
      where: {
        workspace_id: workspaceId,
        user_id: parseInt(userId)
      }
    })

    if (!workspace) {
      // Debug log removed
      return ''
    }

    // Use vector search to find relevant context
    const ragContext = await vectorStore.getContext(userQuery, workspace.id, 3000)
    
    if (ragContext) {
      // Debug log removed}..."`)
      return `\n=== RELEVANT CODE CONTEXT ===\n${ragContext}\n=== END CONTEXT ===\n`
    }

    return ''
  } catch (error) {
    logger.error('Streaming chat RAG context failed', {
      error: error instanceof Error ? error.message : error,
      workspaceId,
    })
    return ''
  }
}

// Helper to build basic workspace context (fallback)
async function buildWorkspaceContext(workspaceId: string, files: string[]) {
  try {
    // Get file contents for context (limit to recent/relevant files)
    const contextFiles = files.slice(0, 5) // Limit context to prevent token overflow
    let contextContent = ''

    for (const file of contextFiles) {
      try {
        // This part is a placeholder for actual file reading logic
        // In a real implementation, you would fetch file content from a source
        // based on the workspaceId and file path.
        contextContent += `\n--- File: ${file} ---\n// ... content of ${file} ...\n`
      } catch (error) {
        logger.warn('Streaming chat file context load failed', {
          error: error instanceof Error ? error.message : error,
          workspaceId,
          file,
        })
      }
    }

    return contextContent
  } catch (error) {
    logger.error('Streaming chat workspace context failed', {
      error: error instanceof Error ? error.message : error,
      workspaceId,
    })
    return ''
  }
}

export async function POST(req: AuthenticatedRequest) {
  try {
    const session = (await getServerSession(authOptions)) as { user?: { id?: string } } | null
    if (!session?.user?.id) {
      logger.warn('Streaming chat unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate request body
    const validation = await validateRequestBody(req, streamingChatRequestSchema)
    if (!validation.success) {
      logger.warn('Streaming chat validation failed', {
        errors: validation.error,
      })
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error },
        { status: 400 }
      )
    }

    const { message, model, context } = validation.data as z.infer<typeof streamingChatRequestSchema>

    // Initialize OpenRouter client
    const openrouter = new OpenAI({
      baseURL: process.env.OPENROUTER_API_BASE,
      apiKey: process.env.OPENROUTER_API_KEY,
    })

    // Build context string
    let contextString = ''
    if (context.files && context.files.length > 0) {
      contextString += await buildWorkspaceContext(context.workspaceId, context.files)
    }
    if (context.workspaceId) {
      contextString += await buildRAGContext(context.workspaceId, message, session.user.id)
    }

    // Construct message history for the model
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert AI pair programmer. Use the provided context to answer the user's question. Context: ${contextString}`
      }
    ];

    for (const msg of context.previousMessages) {
      messages.push({
        role: msg.type,
        content: msg.content
      });
    }

    messages.push({ role: 'user', content: message });

    // Create a streaming completion
    const stream = await openrouter.chat.completions.create({
      model: model,
      messages: messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 4000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    })

    // Set up Server-Sent Events headers
    const { ReadableStream, TextEncoder, Response: GlobalResponse } = globalThis
    const encoder = new TextEncoder()
    const customReadable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''

            if (content) {
              const data = JSON.stringify({
                content,
                model,
                timestamp: new Date().toISOString()
              })

              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }

          // Send completion signal
          controller.enqueue(encoder.encode(`data: {"done": true}\n\n`))
          controller.close()
        } catch (error) {
          logger.error('Streaming chat SSE error', {
            error: error instanceof Error ? error.message : error,
          })
          controller.error(error)
        }
      }
    })

    return new GlobalResponse(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })

  } catch (error) {
    logger.error('Streaming chat request failed', {
      error: error instanceof Error ? error.message : error,
    })

    return NextResponse.json(
      {
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  const { Response: GlobalResponse } = globalThis
  return new GlobalResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
