/**
 * AI Chat API endpoint for VibeCode WebGUI
 * Handles AI-powered assistance with optional RAG context and Datadog observability
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, logAIRequest } from '@/lib/prisma'
import { vectorStore } from '@/lib/vector-store'
import { litellmClient } from '@/lib/ai-clients/litellm-instance'
import { LLMTracer } from '@/lib/monitoring/llm-tracer'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequestBody {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  max_tokens?: number
  stream?: boolean
  workspaceId?: string
  includeRag?: boolean
}

interface RAGSourceSummary {
  content: string
  similarity: number
  metadata: {
    fileId?: number
    fileName?: string
    startLine?: number
    endLine?: number
    language?: string
    tokens?: number
  }
}

function logAIInteraction(
  request: NextRequest,
  event: 'chat_request' | 'chat_response' | 'chat_error',
  metadata: Record<string, unknown>
) {
  const payload = {
    message: `[AI_CHAT] ${event}`,
    timestamp: new Date().toISOString(),
    service: 'vibecode-webgui',
    source: 'ai-chat-api',
    level: event === 'chat_error' ? 'error' : 'info',
    event_type: event,
    http: {
      url: request.url,
      method: request.method,
      user_agent: request.headers.get('user-agent') || 'unknown'
    },
    ai: metadata,
    dd: {
      trace_id: request.headers.get('x-datadog-trace-id'),
      span_id: request.headers.get('x-datadog-span-id')
    }
  }

  console.log(JSON.stringify(payload))
}

function parseUserId(sessionUser: { id?: string | number } | undefined) {
  if (!sessionUser?.id) return null
  const numeric = typeof sessionUser.id === 'string' ? parseInt(sessionUser.id, 10) : sessionUser.id
  return Number.isFinite(numeric) ? numeric : null
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      logAIInteraction(request, 'chat_error', { error: 'Unauthorized' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = parseUserId(session.user)
    if (!userId) {
      logAIInteraction(request, 'chat_error', { error: 'Invalid user session' })
      return NextResponse.json({ error: 'Invalid user session' }, { status: 401 })
    }

    const body = (await request.json()) as ChatRequestBody
    const {
      messages,
      model = process.env.VIBECODE_DEFAULT_LLM_MODEL || 'gpt-4o-mini',
      temperature = 0.7,
      max_tokens,
      stream = false,
      workspaceId,
      includeRag = true
    } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logAIInteraction(request, 'chat_error', { error: 'Messages array is required', model })
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 })
    }

    if (stream) {
      return NextResponse.json(
        { error: 'Streaming is not supported on this endpoint. Use /api/ai/litellm for streaming responses.' },
        { status: 400 }
      )
    }

    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user')
    const userPrompt = lastUserMessage?.content ?? ''

    let ragContext = ''
    let ragSources: RAGSourceSummary[] = []
    let workspaceDbId: number | null = null

    if (includeRag && workspaceId && userPrompt) {
      const workspace = await prisma.workspace.findFirst({
        where: {
          workspace_id: workspaceId,
          user_id: userId
        }
      })

      if (workspace) {
        workspaceDbId = workspace.id
        ragContext = await vectorStore.getContext(userPrompt, workspace.id)
        const searchResults = await vectorStore.search(userPrompt, {
          workspaceId: workspace.id,
          limit: 5,
          threshold: 0.6
        })

        ragSources = searchResults.map(result => ({
          content: result.chunk.content,
          similarity: result.similarity,
          metadata: result.chunk.metadata
        }))
      }
    }

    const augmentedMessages: ChatMessage[] = [...messages]
    if (ragContext) {
      augmentedMessages.unshift({
        role: 'system',
        content: `You are VibeCode, a Lovable.ai style AI pair programmer. Use the following workspace context when helpful:\n${ragContext}`
      })
    }

    logAIInteraction(request, 'chat_request', {
      model,
      message_count: messages.length,
      workspace_id: workspaceId,
      rag_context_included: Boolean(ragContext),
      rag_chunk_count: ragSources.length,
      stream
    })

    const llmResponse = await LLMTracer.traceLLMCall(
      'vibecode.chat.completion',
      {
        model,
        provider: 'litellm',
        userId: session.user.id?.toString(),
        sessionId: request.headers.get('x-session-id') || undefined,
        prompt: userPrompt,
        input: ragContext ? `Context:\n${ragContext}\n\nPrompt:\n${userPrompt}` : userPrompt,
        temperature,
        maxTokens: max_tokens
      },
      async () => {
        return litellmClient.createChatCompletion({
          model,
          messages: augmentedMessages,
          temperature,
          max_tokens,
          metadata: {
            workspaceId,
            ragContextIncluded: Boolean(ragContext),
            ragChunkCount: ragSources.length
          },
          user: session.user.email || session.user.id?.toString() || 'anonymous'
        })
      }
    )

    const processingTime = Date.now() - startTime

    if (llmResponse.usage) {
      LLMTracer.trackTokenUsage(
        'litellm',
        model,
        llmResponse.usage.prompt_tokens,
        llmResponse.usage.completion_tokens,
        llmResponse.cost?.total_cost
      )
    }

    await logAIRequest({
      user_id: userId,
      request_type: 'chat',
      prompt: userPrompt,
      model,
      provider: 'litellm',
      input_tokens: llmResponse.usage?.prompt_tokens,
      output_tokens: llmResponse.usage?.completion_tokens,
      cost: llmResponse.cost?.total_cost,
      duration_ms: processingTime,
      status: 'completed',
      response: llmResponse,
      project_id: null
    })

    logAIInteraction(request, 'chat_response', {
      model,
      processing_time_ms: processingTime,
      response_length: llmResponse.choices?.[0]?.message?.content?.length || 0,
      workspace_id: workspaceId,
      rag_context_included: Boolean(ragContext),
      rag_chunk_count: ragSources.length
    })

    return NextResponse.json({
      ...llmResponse,
      ragContext,
      ragSources,
      metadata: {
        workspaceId,
        workspaceDbId,
        processing_time_ms: processingTime
      }
    }, {
      headers: {
        'X-Processing-Time': processingTime.toString(),
        'X-Model': model
      }
    })
  } catch (error) {
    const processingTime = Date.now() - startTime
    const message = error instanceof Error ? error.message : 'Unknown error'

    logAIInteraction(request, 'chat_error', {
      error: message,
      processing_time_ms: processingTime
    })

    return NextResponse.json({
      error: 'Internal server error',
      message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
