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
// import { createLogger } from '@/lib/logger'
import { z } from '@/lib/zod-compat'

// Use console directly for logging
const logger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
  log: console.log
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Lazy-initialize OpenAI client to avoid build-time errors
let client: ReturnType<typeof createOpenAIAgentsClient> | null = null
let threadManager: ReturnType<typeof getThreadManager> | null = null

function getClient() {
  if (!client) {
    client = createOpenAIAgentsClient()
    const toolRegistry = getToolRegistry()

    try {
      initializeThreadManager({ client })
    } catch (error) {
      console.warn('Thread manager already initialized', { error })
    }

    threadManager = getThreadManager()
  }
  return { client, threadManager, toolRegistry: getToolRegistry() }
}

// Validation schemas
const createAgentSchema = z.object({
  model: z.string(),
  name: z.string(),
  instructions: z.string(),
  tools: z.array(z.any()).optional(),
  metadata: z.record(z.string()).optional(),
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
  metadata: z.record(z.string()).optional(),
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
  return handleRequest(request, params, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, 'POST')
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id?.toString()
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid user session' },
        { status: 401 }
      )
    }

    const path = resolvedParams.path || []
    const [resource, id, subResource, subId] = path

    console.debug('Handling agent API request', {
      method,
      resource,
      id,
      subResource,
      userId,
    })

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
        // Agent CRUD operations
        if (id) {
          return handleAgentOperations(request, method, userId, resource, subResource)
        }
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (error) {
    console.error('API request failed', { error, path: params.path })

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
  const validated = createAgentSchema.parse(body)

  const agent = await client.createAgent({
    ...validated,
    metadata: {
      ...validated.metadata,
      userId,
      createdAt: new Date().toISOString(),
    },
  })

  console.info('Agent created', { agentId: agent.id, userId })

  return NextResponse.json(agent, { status: 201 })
}

async function handleListAgents(request: NextRequest, userId: string) {
  const { client, threadManager, toolRegistry } = getClient()
  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit')) || 20
  const order = (searchParams.get('order') as 'asc' | 'desc') || 'desc'

  const response = await client.listAgents({ limit, order })

  // Filter to user's agents
  const userAgents = response.data.filter(
    (agent) => agent.metadata.userId === userId
  )

  console.debug('Listed agents', { userId, count: userAgents.length })

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
  const { client, threadManager, toolRegistry } = getClient()
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
  const { client, threadManager, toolRegistry } = getClient()

  if (!threadManager) {
    return NextResponse.json(
      { error: 'Thread manager not initialized' },
      { status: 500 }
    )
  }

  if (!id) {
    // Create new thread
    if (method === 'POST') {
      const body = await request.json()
      const validated = createThreadSchema.parse(body)

      const session = await threadManager.createThread(
        userId,
        validated.assistantId,
        {
          messages: validated.messages,
          metadata: validated.metadata,
        }
      )

      console.info('Thread created', { threadId: session.threadId, userId })

      return NextResponse.json(session, { status: 201 })
    }
  } else {
    // Thread operations
    const session = threadManager.getSession(id)
    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    if (subResource === 'messages') {
      return handleThreadMessages(request, method, id, subId)
    }

    if (subResource === 'run' || subResource === 'runs') {
      return handleThreadRuns(request, method, id, subId)
    }

    if (method === 'GET') {
      const context = await threadManager.getContext(id)
      return NextResponse.json(context)
    }

    if (method === 'DELETE') {
      await threadManager.deleteThread(id)
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
  const { client, threadManager, toolRegistry } = getClient()

  if (!threadManager) {
    return NextResponse.json(
      { error: 'Thread manager not initialized' },
      { status: 500 }
    )
  }

  if (method === 'POST') {
    const body = await request.json()
    const validated = addMessageSchema.parse(body)

    const message = await threadManager.addMessage(
      threadId,
      validated.role,
      validated.content,
      validated.attachments
    )

    return NextResponse.json(message, { status: 201 })
  }

  if (method === 'GET') {
    if (messageId) {
      const message = await client.getMessage(threadId, messageId)
      return NextResponse.json(message)
    }

    const messages = await threadManager.getMessageHistory(threadId)
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
  const { client, threadManager, toolRegistry } = getClient()
  if (method === 'POST' && !runId) {
    const body = await request.json()
    const validated = createRunSchema.parse(body)

    // Get tools from registry if not provided
    const tools = validated.tools || toolRegistry.getDefinitions()

    if (validated.stream) {
      // Return streaming response
      const stream = await client.createRunStream(threadId, {
        assistant_id: validated.assistantId,
        instructions: validated.instructions,
        tools,
      })

      return new Response(stream as any, {
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
  const { client, threadManager, toolRegistry } = getClient()
  if (method === 'POST' && !fileId) {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const purpose = (formData.get('purpose') as 'assistants' | 'vision') || 'assistants'

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const fileObject = await client.uploadFile(file, file.name, purpose)

    console.info('File uploaded', { fileId: fileObject.id, userId })

    return NextResponse.json(fileObject, { status: 201 })
  }

  if (fileId) {
    if (method === 'GET') {
      if (operation === 'download') {
        const blob = await client.downloadFile(fileId)
        return new Response(blob, {
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
  const { client, threadManager, toolRegistry } = getClient()
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
  const { client, threadManager, toolRegistry } = getClient()
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
