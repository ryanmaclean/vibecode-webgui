// Enhanced AI Chat API using Vercel AI SDK
// Multi-provider support with standardized streaming and tool calling

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { vectorStore } from '@/lib/vector-store'
import { prisma } from '@/lib/prisma'
import { OpenAI } from 'openai'
import { z } from 'zod'

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

interface EnhancedChatRequest {
  message: string
  model: SupportedModel
  context: {
    workspaceId: string
    files: string[]
    previousMessages: Array<{
      role: 'user' | 'assistant'
      content: string
    }>
  }
  enableTools?: boolean
}

// Enhanced RAG context builder
async function buildEnhancedRAGContext(workspaceId: string, userQuery: string, userId: string) {
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
        relevanceScore: contexts[0] ? 'high' : 'medium'
      }
    }

    return null
  } catch (error) {
    console.error('Enhanced RAG context error:', error)
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

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: EnhancedChatRequest = await request.json()
    const { message, model, context, enableTools = true } = body

    // Validate model
    if (!SUPPORTED_MODELS[model]) {
      return Response.json({ 
        error: `Unsupported model: ${model}. Supported models: ${Object.keys(SUPPORTED_MODELS).join(', ')}` 
      }, { status: 400 })
    }

    // Build enhanced context with RAG
    const ragResult = await buildEnhancedRAGContext(
      context.workspaceId, 
      message, 
      session.user.id
    )

    // Enhanced OpenRouter setup with model selection
    const openrouter = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "VibeCode Enhanced Platform",
      }
    })

    // Prepare system message with enhanced context
    const systemMessage = `You are an expert AI coding assistant integrated into VibeCode platform with enhanced multi-provider capabilities.

**Current Context:**
- Workspace: ${context.workspaceId}
- Model: ${model} (${SUPPORTED_MODELS[model]})
- RAG Status: ${ragResult ? `Active (${ragResult.relevanceScore} relevance)` : 'Disabled'}
- Provider: Enhanced OpenRouter Multi-Model Support

${ragResult ? `**Relevant Code Context:**\n${ragResult.context}\n` : ''}

**Enhanced Capabilities:**
- Multi-provider model access (OpenAI, Anthropic, Google, Meta, Mistral)
- Advanced code generation, debugging, and optimization
- Architecture and design guidance with pattern recognition
- Best practices for modern development across frameworks
- Real-time workspace context and vector search integration
- Framework-specific assistance (React, Next.js, Node.js, Python, etc.)

${getToolCapabilities(enableTools)}

**Guidelines:**
- Reference specific code when available in context
- Provide production-ready, secure code solutions
- Explain reasoning, trade-offs, and alternative approaches
- Use modern patterns consistent with the existing codebase
- Leverage the selected model's strengths (${model})
- Ask clarifying questions when requirements are unclear`

    // Prepare messages for AI SDK
    const messages = [
      { role: 'system' as const, content: systemMessage },
      ...context.previousMessages.slice(-8), // Last 8 messages for context
      { role: 'user' as const, content: message }
    ]

    // Create enhanced streaming response
    const stream = await openrouter.chat.completions.create({
      model: SUPPORTED_MODELS[model],
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 4000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    })

    // Enhanced Server-Sent Events with metadata
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
                tokenCount
              })

              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }

          // Send enhanced completion signal
          controller.enqueue(encoder.encode(`data: {
            "done": true, 
            "finalTokenCount": ${tokenCount},
            "model": "${model}",
            "provider": "${SUPPORTED_MODELS[model]}",
            "ragContext": ${ragResult ? `"${ragResult.relevanceScore}"` : "null"},
            "timestamp": "${new Date().toISOString()}"
          }\n\n`))
          
          controller.close()
          
          // Log enhanced completion analytics
          console.log(`Enhanced AI completion: ${model} (${SUPPORTED_MODELS[model]}), tokens: ~${tokenCount}, RAG: ${ragResult ? ragResult.relevanceScore : 'none'}`)
          
        } catch (error) {
          console.error('Enhanced streaming error:', error)
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
        'X-Provider': SUPPORTED_MODELS[model],
        'X-RAG-Status': ragResult ? 'active' : 'inactive',
        'X-Tools-Enabled': enableTools.toString(),
        'X-Enhanced-Features': 'multi-provider,rag,context-aware'
      }
    })

  } catch (error) {
    console.error('Enhanced chat API error:', error)
    
    return Response.json({
      error: 'Failed to process enhanced chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// CORS support
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