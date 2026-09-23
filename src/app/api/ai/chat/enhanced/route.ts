// Enhanced AI Chat API using Vercel AI SDK
// Multi-provider support with standardized streaming and tool calling

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { vectorStore } from '@/lib/vector-store'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { z } from '@/lib/zod-compat'
import { validateRequestBody } from '@/lib/api/validation/middleware'
import { logger } from '@/lib/logger'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import type { AuthenticatedRequest } from '@/lib/auth/middleware'
import { ContextStrategy, ContextItemType } from '@/types/context'
import { buildChatContext, type FileContext, type ChatMessage } from '@/lib/ai/context/context-integration'
import { trackContextBuild } from '@/lib/ai/context/context-metrics'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

// Rate limiting for AI endpoints (more restrictive than other APIs)
const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

// Provider configuration - Enhanced multi-provider support
const SUPPORTED_MODELS = {
  // OpenAI via OpenRouter
  'gpt-4': 'openai/gpt-4',
  'gpt-4-turbo': 'openai/gpt-4-turbo',
  'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',
  // Anthropic via OpenRouter
  'claude-3-opus': 'anthropic/claude-3-opus',
  'claude-3-sonnet': 'anthropic/claude-3-sonnet-20240229',
  'claude-3-haiku': 'anthropic/claude-3-haiku-20240307',
  // Google via OpenRouter
  'gemini-pro': 'google/gemini-pro',
  'gemini-1.5-pro': 'google/gemini-1.5-pro',
  // Local/Other models
  'llama-3.1-70b': 'meta-llama/llama-3.1-70b-instruct',
  'mistral-large': 'mistralai/mistral-large',
} as const

type SupportedModel = keyof typeof SUPPORTED_MODELS

interface _EnhancedChatRequest {
  message: string
  model: SupportedModel
  context: {
    workspaceId: string
    files: string[]
    pinnedFiles?: string[]
    previousMessages: Array<{
      role: 'user' | 'assistant'
      content: string
    }>
  }
  enableTools?: boolean
}

// Zod validation schema for enhanced chat requests
const ASCII_CONTROL_PATTERN = '^[^\\u0000-\\u001F\\u007F]*$'
const asciiControlRegex = new RegExp(ASCII_CONTROL_PATTERN, 'u')

const enhancedChatRequestSchema = z.object({
  message: z
    .string()
    .min(1)
    .max(4000)
    .regex(asciiControlRegex, 'Message contains invalid characters'),
  model: z.enum(['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'gemini-pro', 'gemini-1.5-pro', 'llama-3.1-70b', 'mistral-large']),
  context: z.object({
    workspaceId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid workspace ID format'),
    files: z.array(z.string().max(500)).max(20),
    pinnedFiles: z.array(z.string().max(500)).max(20).optional(),
    previousMessages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(4000)
    })).max(50)
  }),
  enableTools: z.boolean().optional().default(false)
})

// Enhanced RAG context builder
async function buildEnhancedRAGContext(workspaceId: string, userQuery: string, userId: string): Promise<{ context: string; workspaceId: string; relevanceScore: 'high' | 'medium' } | null> {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: {
        workspace_id: workspaceId,
        user_id: parseInt(userId)
      }
    })

    if (!workspace) {
      return null
    }

    // Multi-threshold vector search for better context
    const contexts = await Promise.all([
      vectorStore.getContext(userQuery, workspace.id, 2000, 0.8), // High relevance
      vectorStore.getContext(userQuery, workspace.id, 1000, 0.6), // Medium relevance
    ])

    const relevantContext = contexts.filter(Boolean).join('\n---\n')
    
    if (relevantContext) {
      return {
        context: relevantContext,
        workspaceId: workspace.workspace_id,
        relevanceScore: (contexts[0] ? 'high' : 'medium') as 'high' | 'medium'
      }
    }

    return null
  } catch (error) {
    logger.error('Enhanced RAG context build failed', {
      error: error instanceof Error ? error.message : error,
      workspaceId,
    })
    return null
  }
}

// Enhanced tool simulation (integrated into system prompt)
function getToolCapabilities(enableTools: boolean): string {
  if (!enableTools) return ''

  return `

**Available AI Tools:**
- **Code Search**: Can search through workspace for specific patterns, functions, or code structures
- **Project Analysis**: Can analyze project structure, dependencies, patterns, and security
- **Code Generation**: Can generate code snippets based on requirements and framework context
- **RAG Context**: Automatically retrieves relevant code context using vector search

When you need to use these capabilities, mention them explicitly in your response.`
}

// Get allowed origins from environment or use defaults
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
  }
  return ['https://vibecode.dev', 'http://localhost:3000', 'http://localhost:8080']
}

// Validate and return CORS origin if allowed
function getValidatedCorsOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null
  const allowedOrigins = getAllowedOrigins()
  if (allowedOrigins.includes(requestOrigin)) return requestOrigin
  return null
}

export async function POST(request: AuthenticatedRequest): Promise<Response> {
  try {
    // Rate limiting check
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

    // Authentication check
    const session = (await getServerSession(authOptions)) as {
      user?: {
        id?: string
        role?: string
        email?: string
      }
    } | null
    if (!session?.user?.id) {
      logger.warn('Enhanced chat unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate request body
    const validation = await validateRequestBody(request, enhancedChatRequestSchema)
    if (!validation.success) {
      logger.warn('Enhanced chat validation failed', {
        errors: validation.error,
      })
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error },
        { status: 400 }
      )
    }

    const { message, model, context, enableTools = true } = validation.data as z.infer<typeof enhancedChatRequestSchema>
    const selectedModel = model as SupportedModel

    // Validate model
    if (!SUPPORTED_MODELS[selectedModel]) {
      return NextResponse.json({ 
        error: `Unsupported model: ${model}. Supported models: ${Object.keys(SUPPORTED_MODELS).join(', ')}` 
      }, { status: 400 })
    }

    // Build enhanced context with RAG
    const ragResult = await buildEnhancedRAGContext(
      context.workspaceId,
      message,
      session.user.id
    )

    if (!ragResult) {
      logger.info('Enhanced chat proceeding without RAG context', {
        workspaceId: context.workspaceId,
      })
    }

    // Base system prompt (CRITICAL priority - always included)
    const baseSystemPrompt = `You are an expert AI coding assistant integrated into VibeCode platform with enhanced multi-provider capabilities.

**🎯 Current Session Context:**
- User: ${session.user.email}
- Workspace: ${context.workspaceId}
- Model: ${selectedModel} (${SUPPORTED_MODELS[selectedModel]})
- RAG Status: ${ragResult ? `Active (${ragResult.relevanceScore} relevance)` : 'Disabled'}
- Provider: Enhanced OpenRouter Multi-Model Support

**🚀 Platform Capabilities:**
- Multi-provider model access (OpenAI, Anthropic, Google, Meta, Mistral)
- Advanced code generation, debugging, and optimization
- Architecture and design guidance with pattern recognition
- Best practices for modern development across frameworks
- Real-time workspace context and vector search integration
- Framework-specific assistance (React, Next.js, Node.js, Python, etc.)

**📐 Guidelines:**
- Provide production-ready, secure code solutions
- Reference specific code from context when available
- Explain reasoning, trade-offs, and alternatives
- Use modern patterns consistent with the existing codebase
- Leverage the selected model's strengths (${selectedModel})
- Ask clarifying questions when requirements are unclear`

    // Add tool capabilities
    const toolCapabilities = getToolCapabilities(enableTools)
    const systemPromptWithTools = toolCapabilities ? baseSystemPrompt + toolCapabilities : baseSystemPrompt

    // Build file contexts with pinned status
    const pinnedFilesSet = new Set(context.pinnedFiles || [])
    const fileContexts: FileContext[] = context.files.map(filePath => ({
      path: filePath,
      content: '', // Content will be loaded if needed
      isPinned: pinnedFilesSet.has(filePath)
    }))

    // Convert previous messages to ChatMessage format
    const previousChatMessages: ChatMessage[] = context.previousMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    // Generate request ID for metrics tracking
    const requestId = `enhanced-${session.user.id}-${Date.now()}`

    // Use buildChatContext helper for intelligent context management with metrics tracking
    const contextBuildResult = await trackContextBuild(requestId, async () => {
      return buildChatContext({
        model: selectedModel,
        strategy: ContextStrategy.HYBRID,
        maxUtilization: 90,
        previousMessages: previousChatMessages,
        ragContext: ragResult ? {
          context: ragResult.context,
          workspaceId: ragResult.workspaceId,
          relevanceScore: ragResult.relevanceScore,
          strategiesUsed: 1,
          totalLength: ragResult.context.length
        } : undefined,
        files: fileContexts,
        userMessage: message,
        systemPrompt: systemPromptWithTools,
        boostKeywords: ragResult ? ['code', 'function', 'implementation'] : []
      })
    })

    const builtContext = contextBuildResult.result

    // Get optimized context window
    const optimizedWindow = builtContext.window

    // Build final messages array from optimized context
    const messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }> = []

    if (optimizedWindow) {
      // Group items by type for proper message structure
      let systemContent = ''
      const conversationMessages: Array<{ role: 'user' | 'assistant', content: string }> = []

      for (const item of optimizedWindow.items) {
        switch (item.type) {
          case ContextItemType.SYSTEM_PROMPT:
          case ContextItemType.RAG_RESULT:
          case ContextItemType.CUSTOM:
            systemContent += item.content + '\n\n'
            break
          case ContextItemType.USER_MESSAGE:
          case ContextItemType.ASSISTANT_MESSAGE:
            // These will be added in order later
            if (item.metadata.custom?.role) {
              conversationMessages.push({
                role: item.metadata.custom.role as 'user' | 'assistant',
                content: item.content
              })
            }
            break
        }
      }

      // Add system message if we have content
      if (systemContent.trim()) {
        messages.push({ role: 'system', content: systemContent.trim() })
      }

      // Add conversation history (excluding the current user message)
      messages.push(...conversationMessages.slice(0, -1))

      // Add current user message last
      messages.push({ role: 'user', content: message })

      // Log context optimization stats with metrics
      logger.info('Context window optimized', {
        requestId,
        model: selectedModel,
        totalTokens: builtContext.summary.totalTokens,
        utilizationPercent: builtContext.summary.utilizationPercent,
        messageCount: builtContext.summary.messageCount,
        fileCount: builtContext.summary.fileCount,
        pinnedFileCount: builtContext.summary.pinnedFileCount,
        ragIncluded: builtContext.summary.ragIncluded,
        itemsIncluded: builtContext.includedItems.length,
        itemsExcluded: builtContext.excludedItems.length,
        strategy: optimizedWindow.strategy,
        buildDurationMs: contextBuildResult.durationMs,
        metricsRecorded: !!contextBuildResult.metrics
      })
    } else {
      // Fallback to simple message structure if context manager fails
      const systemMessage = baseSystemPrompt + (ragResult ? `\n\n**📋 Relevant Code Context:**\n${ragResult.context}` : '') + toolCapabilities
      messages.push(
        { role: 'system', content: systemMessage },
        ...context.previousMessages.slice(-8).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: message }
      )
    }

    // Enhanced OpenRouter setup with model selection
    const openrouter = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "VibeCode Enhanced Platform",
      }
    })

    // Create enhanced streaming response
    const stream = await openrouter.chat.completions.create({
      model: SUPPORTED_MODELS[selectedModel],
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 4000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    })

    // Enhanced Server-Sent Events with metadata
    const { ReadableStream, TextEncoder } = globalThis
    const encoder = new TextEncoder()
    const customReadable = new ReadableStream({
      async start(controller) {
        try {
          let tokenCount = 0
          
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''

            if (content) {
              tokenCount += Math.ceil(content.length / 4) // Rough token estimate
              
              const data = JSON.stringify({
                content,
                model,
                provider: SUPPORTED_MODELS[model],
                timestamp: new Date().toISOString(),
                ragActive: !!ragResult,
                toolsEnabled: enableTools,
                tokenCount,
                contextWindow: {
                  totalTokens: optimizedWindow?.totalTokens ?? 0,
                  availableTokens: optimizedWindow?.availableTokens ?? 0,
                  utilizationPercent: optimizedWindow?.utilizationPercent ?? 0,
                  pinnedFileCount: builtContext.summary.pinnedFileCount
                }
              })

              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }

          // Send enhanced completion signal
          const completionData = JSON.stringify({
            done: true,
            finalTokenCount: tokenCount,
            model,
            provider: SUPPORTED_MODELS[model],
            ragContext: ragResult ? ragResult.relevanceScore : null,
            contextWindow: optimizedWindow ? {
              totalTokens: optimizedWindow.totalTokens,
              availableTokens: optimizedWindow.availableTokens,
              utilizationPercent: optimizedWindow.utilizationPercent,
              pinnedFileCount: builtContext.summary.pinnedFileCount,
              fileCount: builtContext.summary.fileCount,
              isAtCapacity: optimizedWindow.isAtCapacity
            } : null,
            timestamp: new Date().toISOString()
          })
          controller.enqueue(encoder.encode(`data: ${completionData}\n\n`))
          
          controller.close()
          
          // Log enhanced completion analytics
          // Debug log removed, tokens: ~${tokenCount}, RAG: ${ragResult ? ragResult.relevanceScore : 'none'}`)
          
        } catch (error) {
          logger.error('Enhanced chat streaming error', {
            error: error instanceof Error ? error.message : error,
          })
          controller.error(error)
        }
      }
    })

    const { Response: GlobalResponse } = globalThis

    // Validate CORS origin
    const requestOrigin = request.headers.get('origin')
    const validatedOrigin = getValidatedCorsOrigin(requestOrigin)
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'X-Model-Used': selectedModel,
      'X-Provider': SUPPORTED_MODELS[selectedModel],
      'X-RAG-Status': ragResult ? 'active' : 'inactive',
      'X-Tools-Enabled': enableTools.toString(),
      'X-Enhanced-Features': 'multi-provider,rag,context-aware',
      'X-Context-Tokens-Used': optimizedWindow?.totalTokens.toString() ?? '0',
      'X-Context-Tokens-Available': optimizedWindow?.availableTokens.toString() ?? '0',
      'X-Context-Utilization': optimizedWindow?.utilizationPercent.toFixed(1) ?? '0',
      'X-Context-Pinned-Files': builtContext.summary.pinnedFileCount.toString()
    }

    if (validatedOrigin) {
      responseHeaders['Access-Control-Allow-Origin'] = validatedOrigin
      responseHeaders['Vary'] = 'Origin'
    }

    return new GlobalResponse(customReadable, {
      headers: responseHeaders
    })

  } catch (error) {
    logger.error('Enhanced chat request failed', {
      error: error instanceof Error ? error.message : error,
    })

    return NextResponse.json({
      error: 'Failed to process enhanced chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// CORS support
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const requestOrigin = request.headers.get('origin')
  const validatedOrigin = getValidatedCorsOrigin(requestOrigin)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '3600',
  }
  if (validatedOrigin) {
    headers['Access-Control-Allow-Origin'] = validatedOrigin
    headers['Vary'] = 'Origin'
  }
  return new NextResponse(null, { status: 200, headers })
}
