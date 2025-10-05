/**
 * AI Chat API endpoint for VibeCode WebGUI
 * Handles AI-powered assistance with optional RAG context and Datadog observability
 */

import { NextRequest, NextResponse } from 'next/server'
// import { getServerSession } from 'next-auth'
// import { authOptions } from '@/lib/auth' // TODO: Add authentication when ready

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

interface AIInteractionMetadata {
  model?: string
  provider?: string
  messageCount?: number
  error?: string
  responseTime?: number
  [key: string]: string | number | boolean | undefined
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content?: string
  [key: string]: unknown
}

function logAIInteraction(
  request: NextRequest,
  event: 'chat_request' | 'chat_response' | 'chat_error',
  metadata: AIInteractionMetadata
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

  const span = tracer.startSpan('api.ai.chat', {
    tags: {
      'http.method': 'POST',
      endpoint: '/api/ai/chat',
      'resource.name': 'POST /api/ai/chat',
      'span.type': 'web'
    }
  })

  const scope = tracer.scope()

  const respond = (
    status: number,
    body: Record<string, unknown>,
    init?: Omit<ResponseInit, 'status'>
  ) => {
    span.setTag('http.status_code', status)
    if (status >= 400) {
      span.setTag('error', true)
    }
    return NextResponse.json(body, { status, ...(init || {}) })
  }

  try {
    return await scope.activate(span, async () => {
      const allowTestBypass = process.env.ALLOW_UNAUTHENTICATED_AI_TESTS === 'true'
      const session = (await getServerSession(authOptions)) ?? (allowTestBypass
        ? { user: { id: 1, email: 'test-bypass@local' } }
        : null)

      if (!session?.user) {
        logAIInteraction(request, 'chat_error', { error: 'Unauthorized' })
        return respond(401, { error: 'Unauthorized' })
      }

      const userId = parseUserId(session.user)
      if (!allowTestBypass && !userId) {
        logAIInteraction(request, 'chat_error', { error: 'Invalid user session' })
        return respond(401, { error: 'Invalid user session' })
      }

      const body = (await request.json()) as ChatRequestBody
      const {
        messages,
        model: requestedModel,
        temperature = 0.7,
        max_tokens,
        stream = false,
        workspaceId,
        includeRag = true
      } = body

      const model = requestedModel || pickFreeModel()

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        logAIInteraction(request, 'chat_error', { error: 'Messages array is required', model })
        return respond(400, { error: 'Messages array is required' })
      }

      if (stream) {
        return respond(400, {
          error: 'Streaming is not supported on this endpoint. Use /api/ai/litellm for streaming responses.'
        })
      }

      const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user')
      const userPrompt = lastUserMessage?.content ?? ''

      let ragContext = ''
      let ragSources: RAGSourceSummary[] = []
      let workspaceDbId: number | null = null

      if (!allowTestBypass && includeRag && workspaceId && userPrompt) {
        const numericUserId = userId as number;
        const workspace = await prisma.workspace.findFirst({
          where: {
            workspace_id: workspaceId,
            user_id: numericUserId
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
        rag_context_included: String(Boolean(ragContext)),
        rag_chunk_count: String(ragSources.length),
        stream
      })

      const llmOutcome = await LLMTracer.traceLLMCall(
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
        }
      );

      type LiteLLMResponse = ChatCompletionResponse & {
        cost?: { total_cost?: number };
      };

      const fallbackResult = llmOutcome as Partial<ChatCompletionFallbackResult> | LiteLLMResponse;
      const defaultLiteLLMResponse: LiteLLMResponse = {
        id: 'fallback-response',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Mock response unavailable',
            },
            finish_reason: 'stop',
            index: 0,
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };

      const llmResponse: LiteLLMResponse = (fallbackResult && typeof fallbackResult === 'object' && 'response' in fallbackResult)
        ? (fallbackResult.response as LiteLLMResponse)
        : (fallbackResult as LiteLLMResponse | undefined) ?? defaultLiteLLMResponse;

      const modelUsed = (fallbackResult && typeof fallbackResult === 'object' && 'modelUsed' in fallbackResult)
        ? (fallbackResult as { modelUsed?: string }).modelUsed ?? llmResponse.model ?? model
        : llmResponse.model ?? model;

      const providerUsed = (fallbackResult && typeof fallbackResult === 'object' && 'provider' in fallbackResult)
        ? (fallbackResult as { provider?: string }).provider ?? 'litellm'
        : 'litellm';
      const processingTime = Date.now() - startTime

      if (llmResponse.usage) {
        LLMTracer.trackTokenUsage(
          providerUsed,
          modelUsed,
          llmResponse.usage.prompt_tokens ?? 0,
          llmResponse.usage.completion_tokens ?? 0,
          llmResponse.cost?.total_cost
        )
      }

      try {
        let responsePayload: Prisma.InputJsonValue | undefined
        try {
          responsePayload = JSON.parse(JSON.stringify(llmResponse)) as Prisma.InputJsonValue
        } catch {
          responsePayload = undefined
        }

        await logAIRequest({
          user_id: userId ?? 0,
          request_type: 'chat',
          prompt: userPrompt,
          model: modelUsed,
          provider: providerUsed,
          input_tokens: llmResponse.usage?.prompt_tokens,
          output_tokens: llmResponse.usage?.completion_tokens,
          cost: llmResponse.cost?.total_cost,
          duration_ms: processingTime,
          status: 'completed',
          response: responsePayload,
          project_id: undefined
        })
      } catch (loggingError) {
        console.warn('[AI_CHAT] Failed to persist AI request log', loggingError)
      }

      span.setTag('ai.model', modelUsed)
      if (workspaceDbId) {
        span.setTag('workspace.id', workspaceDbId)
      }

      logAIInteraction(request, 'chat_response', {
        model_requested: model,
        model_used: modelUsed,
        provider: providerUsed,
        processing_time_ms: processingTime,
        response_length: llmResponse.choices?.[0]?.message?.content?.length || 0,
        workspace_id: workspaceId,
        rag_context_included: String(Boolean(ragContext)),
        rag_chunk_count: String(ragSources.length)
      })

      return respond(200, {
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
          'X-Model': modelUsed
        }
      })
    })
  } catch (error) {
    const processingTime = Date.now() - startTime
    const message = error instanceof Error ? error.message : 'Unknown error'

    logAIInteraction(request, 'chat_error', {
      error: message,
      processing_time_ms: processingTime
    })

    span.setTag('error', true)
    span.setTag('error.message', message)

    return respond(500, {
      error: 'Internal server error',
      message,
      timestamp: new Date().toISOString()
    })
  } finally {
    span.finish()
  }
}
