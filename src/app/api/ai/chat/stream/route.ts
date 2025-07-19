// Streaming AI Chat API - OpenRouter integration with multi-model support and RAG
// Powers the AIChatInterface with real-time streaming responses and vector search context

import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { vectorStore } from '@/lib/vector-store'
import { prisma } from '@/lib/prisma'



interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface RawMessage {
  type: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string
  model: string
  context: {
    workspaceId: string
    files: string[]
    previousMessages: RawMessage[]
  }
}

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
      console.log(`No workspace found for ID: ${workspaceId}`)
      return ''
    }

    // Use vector search to find relevant context
    const ragContext = await vectorStore.getContext(userQuery, workspace.id, 3000)
    
    if (ragContext) {
      console.log(`Found RAG context for query: "${userQuery.substring(0, 50)}..."`)
      return `\n=== RELEVANT CODE CONTEXT ===\n${ragContext}\n=== END CONTEXT ===\n`
    }

    return ''
  } catch (error) {
    console.error('Failed to build RAG context:', error)
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
        // In a real implementation, this would read from the workspace
        // For now, we'll use a placeholder
        contextContent += `\n--- ${file} ---\n`
        contextContent += `// File content would be loaded from workspace ${workspaceId}\n`
      } catch (error) {
        console.error(`Failed to read file ${file}:`, error)
      }
    }

    return contextContent
  } catch (error) {
    console.error('Failed to build workspace context:', error)
    return ''
  }
}

// Helper to convert previous messages to OpenAI format
function formatPreviousMessages(messages: RawMessage[]): ChatMessage[] {
  return messages.slice(-6).map(msg => ({  // Last 6 messages for context
    role: msg.type === 'user' ? 'user' : 'assistant',
    content: msg.content
  }))
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // OpenRouter configuration
    const openrouter = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "VibeCode Platform",
      }
    })

    const body: ChatRequest = await request.json()
    const { message, model, context } = body

    // Validate required fields
    if (!message || !model) {
      return NextResponse.json(
        { error: 'Message and model are required' },
        { status: 400 }
      )
    }

    // Check API key
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      )
    }

    // Build enhanced context with RAG
    let enhancedContext = ''
    
    // Try RAG context first (vector search)
    if (context.workspaceId) {
      const ragContext = await buildRAGContext(context.workspaceId, message, session.user.id)
      if (ragContext) {
        enhancedContext = ragContext
      } else {
        // Fallback to basic workspace context
        enhancedContext = await buildWorkspaceContext(context.workspaceId, context.files)
      }
    }
    
    const previousMessages = formatPreviousMessages(context.previousMessages || [])

    // Build system prompt with context
    const systemPrompt = `You are an expert AI coding assistant integrated into the VibeCode development platform. You help developers with:

1. Code generation, debugging, and optimization
2. Architecture and design decisions
3. Best practices and modern development patterns
4. Framework-specific guidance (React, Next.js, Node.js, Python, etc.)
5. DevOps and deployment strategies

Current workspace context:
- Workspace ID: ${context.workspaceId}
- Files in context: ${context.files.length > 0 ? context.files.join(', ') : 'None'}
- Vector search enabled: ${enhancedContext.includes('RELEVANT CODE CONTEXT') ? 'Yes (RAG active)' : 'Basic mode'}

${enhancedContext ? `\nRelevant code context from vector search:\n${enhancedContext}` : ''}

Guidelines:
- Use the provided context to give specific, relevant answers
- Reference specific files and line numbers when available in context
- Provide practical, production-ready code that builds on existing codebase
- Explain your reasoning and trade-offs
- Ask clarifying questions when needed
- Focus on security and performance best practices
- Use modern JavaScript/TypeScript patterns consistent with the codebase
- Be concise but comprehensive`

    // Prepare messages for OpenAI API
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...previousMessages,
      { role: 'user', content: message }
    ]

    // Create streaming response
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
          console.error('Streaming error:', error)
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
      }
    })

  } catch (error) {
    console.error('Chat API error:', error)

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
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
