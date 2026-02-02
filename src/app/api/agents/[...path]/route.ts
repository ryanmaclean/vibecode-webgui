/**
 * OpenAI Agents API Route Handler
 * Provides RESTful endpoints for agent operations
 *
 * Endpoints:
 * - POST /api/agents/create - Create a new agent
 * - GET /api/agents/:id - Get agent details
 * - POST /api/agents/:id/update - Update agent
 * - DELETE /api/agents/:id - Delete agent
 * - GET /api/agents/list - List all agents
 *
 * - POST /api/agents/threads/create - Create a new thread
 * - GET /api/agents/threads/:id - Get thread details
 * - POST /api/agents/threads/:id/messages - Add message to thread
 * - GET /api/agents/threads/:id/messages - Get thread messages
 * - POST /api/agents/threads/:id/run - Execute a run
 * - GET /api/agents/threads/:id/runs/:runId - Get run status
 *
 * - POST /api/agents/files/upload - Upload a file
 * - GET /api/agents/files/:id - Get file metadata
 * - GET /api/agents/files/:id/download - Download file content
 * - DELETE /api/agents/files/:id - Delete file
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createOpenAIAgentsClient } from '@/lib/agents/openai-client'
import { getToolRegistry } from '@/lib/agents/tool-registry'
import {
  getThreadManager,
  initializeThreadManager,
} from '@/lib/agents/thread-manager'
import { logger } from '@/lib/logger'
import { z } from '@/lib/zod-compat'
import {
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  clampLimit,
} from '@/lib/api/pagination'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

const { Response: GlobalResponse, ReadableStream, TextEncoder } = globalThis

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Lazy-initialize OpenAI client to avoid build-time errors
let client: ReturnType<typeof createOpenAIAgentsClient> | null = null
let _threadManager: ReturnType<typeof getThreadManager> | null = null

function getClient() {
  if (!client) {
    client = createOpenAIAgentsClient()
    const _toolRegistry = getToolRegistry()

    try {
      initializeThreadManager({ client })
    } catch (error) {
      logger.warn('Thread manager already initialized', {
        error: error instanceof Error ? error.message : error,
      })
    }

    _threadManager = getThreadManager()
  }
  return { client, _threadManager, toolRegistry: getToolRegistry() }
}

// Validation schemas
const createAgentSchema = z.object({
  model: z.string(),
  name: z.string(),
  instructions: z.string(),
  tools: z.array(z.any()).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
})

const createThreadSchema = z.object({
  assistantId: z.string(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

const addMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  attachments: z.array(z.any()).optional(),
})

const createRunSchema = z.object({
  assistantId: z.string(),
  instructions: z.string().optional(),
  tools: z.array(z.any()).optional(),
  stream: z.boolean().optional(),
})

/**
 * Main route handler
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
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

  return handleRequest(request, params, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
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

  return handleRequest(request, params, 'POST')
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
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

  return handleRequest(request, params, 'DELETE')
}

/**
 * Route dispatcher
 */
async function handleRequest(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
) {
  try {
    const resolvedParams = await params
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      logger.warn('Agents API unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id?.toString()
    if (!userId) {
      logger.error('Agents API missing user id in session')
      return NextResponse.json(
        { error: 'Invalid user session' },
        { status: 401 }
      )
    }

    const path = resolvedParams.path || []
    const [resource, id, subResource, subId] = path

    // Route to appropriate handler
    switch (resource) {
      case 'create':
        if (method === 'POST') {
          return handleCreateAgent(request, userId)
        }
        break

      case 'list':
        if (method === 'GET') {
          return handleListAgents(request, userId)
        }
        break

      case 'threads':
        return handleThreadRoutes(request, method, userId, id, subResource, subId)

      case 'files':
        return handleFileRoutes(request, method, userId, id, subResource)

      case 'tools':
        return handleToolRoutes(request, method, userId, id)

      default:
        // Agent CRUD operations - check if first path element is an agent ID
        if (id) {
          return handleAgentOperations(request, method, userId, resource, subResource)
        } else if (resource?.startsWith('asst_') || resource?.startsWith('thread_') || resource?.startsWith('file_')) {
          // First path element is an agent/thread/file ID
          return handleAgentOperations(request, method, userId, resource, id)
        }
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (error) {
    logger.error('Agents API request failed', {
      error: error instanceof Error ? error.message : error,
    })
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Agent Handlers

async function handleCreateAgent(request: NextRequest, userId: string) {
  const { client } = getClient()
  const body = await request.json()

  try {
    const validated = createAgentSchema.parse(body)

    const agent = await client.createAgent({
      ...validated,
      metadata: {
        ...validated.metadata,
        userId,
        createdAt: new Date().toISOString(),
      },
    })

    logger.info('Agent created', { agentId: agent.id, userId })

    return NextResponse.json(agent, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', message: error.message, issues: error.issues },
        { status: 400 }
      )
    }
    throw error
  }
}

async function handleListAgents(request: NextRequest, userId: string) {
  const { client } = getClient()
  const { searchParams } = new globalThis.URL(request.url)
  // Validate and cap limit parameter to prevent resource exhaustion
  const requestedLimit = Number(searchParams.get('limit')) || DEFAULT_PAGE_SIZE.AGENTS
  const limit = clampLimit(requestedLimit, MAX_PAGE_SIZE.AGENTS, DEFAULT_PAGE_SIZE.AGENTS)
  const order = (searchParams.get('order') as 'asc' | 'desc') || 'desc'

  const response = await client.listAgents({ limit, order })

  // Filter to user's agents - handle empty response
  const userAgents = (response.data || []).filter(
    (agent) => agent.metadata.userId === userId
  )

  // console.debug('Listed agents', { userId, count: userAgents.length })

  return NextResponse.json({
    ...response,
    data: userAgents,
  })
}

async function handleAgentOperations(
  request: NextRequest,
  method: string,
  userId: string,
  agentId: string,
  operation?: string
) {
  const { client } = getClient()
  // Verify ownership
  const agent = await client.getAgent(agentId)
  if (agent.metadata.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  switch (method) {
    case 'GET':
      return NextResponse.json(agent)

    case 'POST':
      if (operation === 'update') {
        const body = await request.json()
        const updated = await client.updateAgent(agentId, body)
        return NextResponse.json(updated)
      }
      break

    case 'DELETE':
      await client.deleteAgent(agentId)
      return NextResponse.json({ deleted: true, id: agentId })
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

// Thread Handlers

async function handleThreadRoutes(
  request: NextRequest,
  method: string,
  userId: string,
  id?: string,
  subResource?: string,
  subId?: string
) {
  const { _threadManager } = getClient()

  if (!_threadManager) {
    return NextResponse.json(
      { error: 'Thread manager not initialized' },
      { status: 500 }
    )
  }

  if (!id) {
    // Create new thread
    if (method === 'POST') {
      try {
        const body = await request.json()
        const validated = createThreadSchema.parse(body)

        const session = await _threadManager.createThread(
          userId,
          validated.assistantId,
          {
            messages: validated.messages,
            metadata: validated.metadata,
          }
        )

        logger.info('Thread created', { threadId: session.threadId, userId })

        return NextResponse.json(session, { status: 201 })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Validation error', message: error.message, issues: error.issues },
            { status: 400 }
          )
        }
        throw error
      }
    }
  } else {
    // Thread operations - validate session if exists, but allow operations even if not in cache
    const session = _threadManager.getSession(id)

    // For message and run operations, allow even if session not cached (may be from external thread)
    if (subResource === 'messages') {
      // Only validate userId if session exists in cache
      if (session && session.userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return handleThreadMessages(request, method, id, subId)
    }

    if (subResource === 'run' || subResource === 'runs') {
      // Only validate userId if session exists in cache
      if (session && session.userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return handleThreadRuns(request, method, id, subId)
    }

    // For other operations, require session
    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    if (method === 'GET') {
      const context = await _threadManager.getContext(id)
      return NextResponse.json(context)
    }

    if (method === 'DELETE') {
      await _threadManager.deleteThread(id)
      return NextResponse.json({ deleted: true, id })
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

async function handleThreadMessages(
  request: NextRequest,
  method: string,
  threadId: string,
  messageId?: string
) {
  const { client, _threadManager } = getClient()

  if (!_threadManager) {
    return NextResponse.json(
      { error: 'Thread manager not initialized' },
      { status: 500 }
    )
  }

  if (method === 'POST') {
    try {
      const body = await request.json()
      const validated = addMessageSchema.parse(body)

      const message = await _threadManager.addMessage(
        threadId,
        validated.role,
        validated.content,
        validated.attachments
      )

      return NextResponse.json(message, { status: 201 })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation error', message: error.message, issues: error.issues },
          { status: 400 }
        )
      }
      throw error
    }
  }

  if (method === 'GET') {
    if (messageId) {
      const message = await client.getMessage(threadId, messageId)
      return NextResponse.json(message)
    }

    const messages = await _threadManager.getMessageHistory(threadId)
    return NextResponse.json({ messages })
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

async function handleThreadRuns(
  request: NextRequest,
  method: string,
  threadId: string,
  runId?: string
) {
  const { client, _threadManager, toolRegistry } = getClient()
  if (method === 'POST' && !runId) {
    try {
      const body = await request.json()
      const validated = createRunSchema.parse(body)

      // Get tools from registry if not provided
      const tools = validated.tools || toolRegistry.getDefinitions()

    if (validated.stream) {
      const encoder = new TextEncoder()
      const stream = await client.createRunStream(threadId, {
        assistant_id: validated.assistantId,
        instructions: validated.instructions,
        tools,
      })

      // Use ReadableStream reader pattern instead of for-await-of
      // to avoid async iterator type errors with ReadableStream
      const encodedStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const reader = stream.getReader()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              if (value) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`))
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error) {
            controller.error(error)
          } finally {
            reader.releaseLock()
          }
        },
      })

      return new GlobalResponse(encodedStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

      const run = await client.createRun(threadId, {
        assistant_id: validated.assistantId,
        instructions: validated.instructions,
        tools,
      })

      // Poll until run completes or requires action
      const finalRun = await pollRun(threadId, run.id)

      return NextResponse.json(finalRun)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation error', message: error.message, issues: error.issues },
          { status: 400 }
        )
      }
      throw error
    }
  }

  if (method === 'GET' && runId) {
    const run = await client.getRun(threadId, runId)
    return NextResponse.json(run)
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

// File Handlers

async function handleFileRoutes(
  request: NextRequest,
  method: string,
  userId: string,
  fileId?: string,
  operation?: string
) {
  const { client } = getClient()
  if (method === 'POST' && !fileId) {
    const formData = await request.formData()
    const fileEntry = formData.get('file')
    const fileCtor = typeof globalThis.File !== 'undefined' ? globalThis.File : undefined
    const file = fileCtor && fileEntry instanceof fileCtor ? fileEntry : null
    const purpose = (formData.get('purpose') as 'assistants' | 'vision') || 'assistants'

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const fileObject = await client.uploadFile(file, file.name, purpose)

    logger.info('File uploaded', { fileId: fileObject.id, userId })

    return NextResponse.json(fileObject, { status: 201 })
  }

  if (fileId) {
    if (method === 'GET') {
      if (operation === 'download') {
        const blob = await client.downloadFile(fileId)
        return new GlobalResponse(blob, {
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        })
      }

      const file = await client.getFile(fileId)
      return NextResponse.json(file)
    }

    if (method === 'DELETE') {
      await client.deleteFile(fileId)
      return NextResponse.json({ deleted: true, id: fileId })
    }
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

// Tool Handlers

async function handleToolRoutes(
  request: NextRequest,
  method: string,
  userId: string,
  toolName?: string
) {
  const { toolRegistry } = getClient()
  if (method === 'GET') {
    if (toolName) {
      const tool = toolRegistry.get(toolName)
      if (!tool) {
        return NextResponse.json({ error: 'Tool not found' }, { status: 404 })
      }

      const metrics = toolRegistry.getMetrics(toolName)
      return NextResponse.json({ ...tool, metrics })
    }

    const tools = toolRegistry.list()
    return NextResponse.json({ tools })
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

// Helper Functions

async function pollRun(threadId: string, runId: string, maxAttempts = 60) {
  const { client, toolRegistry } = getClient()
  let attempts = 0

  while (attempts < maxAttempts) {
    const run = await client.getRun(threadId, runId)

    if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
      return run
    }

    if (run.status === 'requires_action') {
      // Execute tools
      const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls
      if (toolCalls) {
        const outputs = await toolRegistry.executeBatch(toolCalls)
        return client.submitToolOutputs(threadId, runId, outputs)
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
    attempts++
  }

  throw new Error('Run polling timeout')
}
