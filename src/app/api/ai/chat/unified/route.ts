// Unified AI Chat API - Next generation multi-provider chat with LiteLLM-inspired architecture
// Supports OpenRouter, direct providers, local models, and fallback chains

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { vectorStore } from '@/lib/vector-store'
import { prisma } from '@/lib/prisma'
import { UnifiedAIClient, type UnifiedChatMessage } from '@/lib/unified-ai-client'
import { z } from 'zod'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

// Zod validation schemas for unified chat API

// Workspace ID validation
const WorkspaceIdSchema = z.string()
  .min(1, 'Workspace ID cannot be empty')
  .max(64, 'Workspace ID exceeds maximum length')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Workspace ID must contain only alphanumeric characters, hyphens, and underscores'
  )

// File path validation (for context files)
const FilePathSchema = z.string()
  .min(1, 'File path cannot be empty')
  .max(1024, 'File path exceeds maximum length')
  .refine(
    (path) => !path.includes('..') && !path.startsWith('/') && !path.includes('\0'),
    'File path contains invalid or unsafe patterns'
  )

// Message validation
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant'], {
    errorMap: () => ({ message: 'Message role must be "user" or "assistant"' })
  }),
  content: z.string()
    .min(1, 'Message content cannot be empty')
    .max(50000, 'Message content exceeds 50KB limit')
    .refine(
      (content) => !content.includes('\0'),
      'Message content contains null bytes'
    )
}).strict()

// AI model validation
const ModelNameSchema = z.string()
  .min(1, 'Model name cannot be empty')
  .max(128, 'Model name exceeds maximum length')
  .regex(
    /^[a-zA-Z0-9_\-\/.]+$/,
    'Model name must contain only alphanumeric characters, hyphens, underscores, slashes, and dots'
  )
  .refine(
    (model) => {
      // Block attempts to access system models or paths
      const blocked = ['../../../', '..\\..\\', '/etc/', '/proc/', '/sys/', 'file://']
      return !blocked.some(pattern => model.includes(pattern))
    },
    'Model name contains invalid path patterns'
  )

// API key validation (basic structure check, no secrets logging)
const ApiKeySchema = z.string()
  .min(20, 'API key too short')
  .max(256, 'API key exceeds maximum length')
  .regex(
    /^[a-zA-Z0-9_\-\.]+$/,
    'API key contains invalid characters'
  )
  .optional()

// Request body validation
const UnifiedChatRequestSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(50000, 'Message exceeds 50KB limit')
    .refine(
      (msg) => !msg.includes('\0'),
      'Message contains null bytes'
    ),
  model: ModelNameSchema,
  context: z.object({
    workspaceId: WorkspaceIdSchema,
    files: z.array(FilePathSchema)
      .max(100, 'Too many context files (max 100)')
      .default([]),
    previousMessages: z.array(ChatMessageSchema)
      .max(50, 'Too many previous messages (max 50)')
      .default([])
  }).strict(),
  enableTools: z.boolean().default(true),
  userApiKeys: z.object({
    openai: ApiKeySchema,
    anthropic: ApiKeySchema,
    google: ApiKeySchema
  }).partial().strict().optional(),
  preferences: z.object({
    temperature: z.number()
      .min(0, 'Temperature must be >= 0')
      .max(2, 'Temperature must be <= 2')
      .optional(),
    maxTokens: z.number()
      .int('Max tokens must be an integer')
      .min(1, 'Max tokens must be >= 1')
      .max(32000, 'Max tokens exceeds limit (32000)')
      .optional(),
    enableFallback: z.boolean().optional()
  }).strict().optional()
}).strict()

interface UnifiedChatRequest {
  message: string
  model: string
  context: {
    workspaceId: string
    files: string[]
    previousMessages: Array<{
      role: 'user' | 'assistant'
      content: string
    }>
  }
  enableTools?: boolean
  userApiKeys?: {
    openai?: string
    anthropic?: string
    google?: string
  }
  preferences?: {
    temperature?: number
    maxTokens?: number
    enableFallback?: boolean
  }
}

// Enhanced RAG context builder with multiple strategies
async function buildAdvancedRAGContext(workspaceId: string, userQuery: string, userId: string) {
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

    // Multi-strategy context retrieval
    const strategies = await Promise.allSettled([
      // High relevance semantic search
      vectorStore.getContext(userQuery, workspace.id, 2000, 0.85),
      // Medium relevance with more results
      vectorStore.getContext(userQuery, workspace.id, 1500, 0.7),
      // Keyword-based fallback
      vectorStore.getContext(userQuery, workspace.id, 1000, 0.5)
    ])

    const contexts = strategies
      .filter((result): result is PromiseFulfilledResult<string> =>
        result.status === 'fulfilled' && Boolean(result.value))
      .map(result => result.value)

    if (contexts.length === 0) {
      return null
    }

    // Combine and deduplicate contexts
    const combinedContext = contexts.join('\n---\n')
    const relevanceScore = contexts.length > 1 ? 'high' : contexts.length === 1 ? 'medium' : 'low'

    return {
      context: combinedContext,
      workspaceId: workspace.workspace_id,
      relevanceScore,
      strategiesUsed: contexts.length,
      totalLength: combinedContext.length
    }
  } catch (error) {
    console.error('Advanced RAG context error:', error)
    return null
  }
}

// Tool capabilities for enhanced AI responses
function generateToolCapabilities(enableTools: boolean, availableProviders: string[]): string {
  if (!enableTools) return ''

  return `

**Available AI Tools & Capabilities:**
- **Code Analysis**: Deep analysis of project structure, dependencies, and patterns
- **File Operations**: Read, write, and modify files within workspace boundaries
- **Vector Search**: Semantic search across codebase with relevance scoring
- **Multi-Model Access**: ${availableProviders.join(', ')} providers available
- **Fallback Chains**: Automatic failover between providers for reliability
- **Context Enhancement**: Multi-strategy RAG with adaptive context building

**Provider Status:**
${availableProviders.map(p => `- ${p}: Available`).join('\n')}

When you need specific capabilities, I'll automatically use the most appropriate tools and providers.`
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Validate request body with comprehensive security checks
    const validation = UnifiedChatRequestSchema.safeParse(body)

    if (!validation.success) {
      console.warn('[UNIFIED_CHAT] Invalid request body', {
        errors: validation.error.errors,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userId: session.user.id
      })
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      )
    }

    const {
      message,
      model,
      context,
      enableTools = true,
      userApiKeys = {},
      preferences = {}
    } = validation.data

    // Additional security check: Rate limiting by message size
    const messageSize = message.length + context.previousMessages.reduce((sum, msg) => sum + msg.content.length, 0)
    const MAX_TOTAL_MESSAGE_SIZE = 100000 // 100KB total for DoS protection

    if (messageSize > MAX_TOTAL_MESSAGE_SIZE) {
      console.warn('[UNIFIED_CHAT] Total message size exceeds limit', {
        messageSize,
        maxSize: MAX_TOTAL_MESSAGE_SIZE,
        userId: session.user.id
      })
      return NextResponse.json(
        { error: 'Total message size exceeds limit' },
        { status: 413 }
      )
    }

    // Initialize unified AI client with user's API keys
    const aiClient = new UnifiedAIClient(userApiKeys)

    // Get available providers and models
    const availableProviders = aiClient.getAvailableProviders().map(p => p.name)
    const providerHealth = await aiClient.getProviderHealth()

    console.log('[UNIFIED_CHAT] Provider health check', {
      providers: availableProviders,
      health: providerHealth,
      userId: session.user.id
    })

    // Build advanced RAG context
    const ragResult = await buildAdvancedRAGContext(
      context.workspaceId,
      message,
      session.user.id
    )

    // Prepare system message with enhanced context
    const systemMessage = `You are an expert AI coding assistant integrated into VibeCode, an open-source development platform.

**Current Session Context:**
- User: ${session.user.email}
- Workspace: ${context.workspaceId}
- Model: ${model}
- RAG Status: ${ragResult ? `Active (${ragResult.relevanceScore} relevance, ${ragResult.strategiesUsed} strategies)` : 'Disabled'}
- Providers Available: ${availableProviders.join(', ')}

${ragResult ? `**Relevant Code Context (${ragResult.totalLength} chars):**\n${ragResult.context}\n` : ''}

**Platform Capabilities:**
- Multi-provider AI access with automatic fallbacks
- Advanced RAG with semantic search and context ranking
- Local model support (Ollama, LocalAI) for privacy and cost savings
- BYOK (Bring Your Own Keys) support for premium features
- Real-time workspace integration and file system access
- Voice input, file uploads, and multimodal processing

${generateToolCapabilities(enableTools, availableProviders)}

**Guidelines:**
- Provide production-ready, secure code solutions
- Reference specific code from context when available
- Explain reasoning, trade-offs, and alternatives
- Use modern patterns consistent with the existing codebase
- Leverage the selected model's strengths optimally
- If a provider fails, I'll automatically try fallbacks
- Ask clarifying questions when requirements are unclear

**Privacy & Security:**
- User API keys are handled securely and never logged
- Local models available for sensitive code
- All responses respect workspace boundaries`

    // Prepare messages for unified client
    const messages: UnifiedChatMessage[] = [
      { role: 'system', content: systemMessage },
      ...context.previousMessages.slice(-8).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ]

    // Enhanced streaming response with unified client
    const encoder = new TextEncoder()
    const customReadable = new ReadableStream({
      async start(controller) {
        try {
          let fullContent = ''
          let tokenCount = 0
          const startTime = Date.now()

          // Use unified client for streaming
          const streamOptions = {
            temperature: preferences.temperature || 0.7,
            maxTokens: preferences.maxTokens || 4000,
            topP: 1,
            frequencyPenalty: 0,
            presencePenalty: 0
          }

          for await (const chunk of aiClient.chatStream(messages, model, streamOptions)) {
            if (chunk.content) {
              fullContent += chunk.content
              tokenCount = chunk.usage?.totalTokens || Math.ceil(fullContent.length / 4)

              const data = JSON.stringify({
                content: chunk.content,
                model: chunk.model,
                provider: chunk.provider,
                timestamp: new Date().toISOString(),
                ragActive: !!ragResult,
                ragStrategies: ragResult?.strategiesUsed || 0,
                toolsEnabled: enableTools,
                tokenCount,
                availableProviders,
                providerHealth: Object.entries(providerHealth).filter(([_, healthy]) => healthy).map(([name]) => name)
              })

              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }

            if (chunk.done) {
              break
            }
          }

          // Send enhanced completion signal
          const completionData = JSON.stringify({
            done: true,
            finalTokenCount: tokenCount,
            model,
            provider: aiClient.getProviderForModel ? aiClient.getProviderForModel(model) : 'unknown',
            ragContext: ragResult ? {
              relevanceScore: ragResult.relevanceScore,
              strategiesUsed: ragResult.strategiesUsed,
              contextLength: ragResult.totalLength
            } : null,
            processingTime: Date.now() - startTime,
            availableProviders: availableProviders.length,
            healthyProviders: Object.values(providerHealth).filter(Boolean).length,
            timestamp: new Date().toISOString()
          })

          controller.enqueue(encoder.encode(`data: ${completionData}\n\n`))
          controller.close()

          // Enhanced completion analytics
          console.log(`[UNIFIED_CHAT] Completion: ${model}, tokens: ${tokenCount}, providers: ${availableProviders.length}, RAG: ${ragResult?.relevanceScore || 'none'}`)

        } catch (error) {
          console.error('[UNIFIED_CHAT] Streaming error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: session.user.id,
            model
          })

          // Send error with fallback suggestions
          const errorData = JSON.stringify({
            error: true,
            message: 'AI request failed',
            details: error instanceof Error ? error.message : 'Unknown error',
            suggestions: [
              'Try a different model',
              'Check your API keys',
              'Use a local model',
              'Retry with simpler prompt'
            ],
            availableFallbacks: availableProviders.filter(p => providerHealth[p.toLowerCase()])
          })

          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.error(error)
        }
      }
    })

    return new Response(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Model-Used': model,
        'X-Providers-Available': availableProviders.join(','),
        'X-RAG-Status': ragResult ? 'active' : 'inactive',
        'X-Tools-Enabled': enableTools.toString(),
        'X-Enhanced-Features': 'unified-ai,multi-provider,advanced-rag,fallback-chains'
      }
    })

  } catch (error) {
    console.error('[UNIFIED_CHAT] API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json(
      {
        error: 'Failed to process unified chat request',
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [
          'Check your API keys configuration',
          'Try using a local model',
          'Verify your network connection',
          'Contact support if the issue persists'
        ]
      },
      { status: 500 }
    )
  }
}

// Enhanced CORS support
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
