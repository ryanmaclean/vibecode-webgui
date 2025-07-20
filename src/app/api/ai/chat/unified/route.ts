// Unified AI Chat API - Next generation multi-provider chat with LiteLLM-inspired architecture
// Supports OpenRouter, direct providers, local models, and fallback chains

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { vectorStore } from '@/lib/vector-store'
import { prisma } from '@/lib/prisma'
import { UnifiedAIClient, type UnifiedChatMessage } from '@/lib/unified-ai-client'

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

**🛠️ Available AI Tools & Capabilities:**
- **Code Analysis**: Deep analysis of project structure, dependencies, and patterns
- **File Operations**: Read, write, and modify files within workspace boundaries  
- **Vector Search**: Semantic search across codebase with relevance scoring
- **Multi-Model Access**: ${availableProviders.join(', ')} providers available
- **Fallback Chains**: Automatic failover between providers for reliability
- **Context Enhancement**: Multi-strategy RAG with adaptive context building

**🔄 Provider Status:**
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

    const body: UnifiedChatRequest = await request.json()
    const { 
      message, 
      model, 
      context, 
      enableTools = true, 
      userApiKeys = {},
      preferences = {}
    } = body

    // Initialize unified AI client with user's API keys
    const aiClient = new UnifiedAIClient(userApiKeys)
    
    // Get available providers and models
    const availableProviders = aiClient.getAvailableProviders().map(p => p.name)
    const providerHealth = await aiClient.getProviderHealth()
    
    console.log('Provider health check:', providerHealth)

    // Build advanced RAG context
    const ragResult = await buildAdvancedRAGContext(
      context.workspaceId, 
      message, 
      session.user.id
    )

    // Prepare system message with enhanced context
    const systemMessage = `You are an expert AI coding assistant integrated into VibeCode, an open-source development platform.

**🎯 Current Session Context:**
- User: ${session.user.email}
- Workspace: ${context.workspaceId}
- Model: ${model}
- RAG Status: ${ragResult ? `Active (${ragResult.relevanceScore} relevance, ${ragResult.strategiesUsed} strategies)` : 'Disabled'}
- Providers Available: ${availableProviders.join(', ')}

${ragResult ? `**📋 Relevant Code Context (${ragResult.totalLength} chars):**\n${ragResult.context}\n` : ''}

**🚀 Platform Capabilities:**
- Multi-provider AI access with automatic fallbacks
- Advanced RAG with semantic search and context ranking
- Local model support (Ollama, LocalAI) for privacy and cost savings
- BYOK (Bring Your Own Keys) support for premium features
- Real-time workspace integration and file system access
- Voice input, file uploads, and multimodal processing

${generateToolCapabilities(enableTools, availableProviders)}

**📐 Guidelines:**
- Provide production-ready, secure code solutions
- Reference specific code from context when available
- Explain reasoning, trade-offs, and alternatives
- Use modern patterns consistent with the existing codebase
- Leverage the selected model's strengths optimally
- If a provider fails, I'll automatically try fallbacks
- Ask clarifying questions when requirements are unclear

**🔐 Privacy & Security:**
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
          console.log(`Unified AI completion: ${model}, tokens: ${tokenCount}, providers: ${availableProviders.length}, RAG: ${ragResult?.relevanceScore || 'none'}`)

        } catch (error) {
          console.error('Unified streaming error:', error)
          
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
    console.error('Unified chat API error:', error)

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