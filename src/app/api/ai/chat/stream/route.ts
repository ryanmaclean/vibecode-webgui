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
        // This part is a placeholder for actual file reading logic
        // In a real implementation, you would fetch file content from a source
        // based on the workspaceId and file path.
        contextContent += `\n--- File: ${file} ---\n// ... content of ${file} ...\n`
      } catch (error) {
        console.error(`Failed to read context file ${file}:`, error)
      }
    }

    return contextContent
  } catch (error) {
    console.error('Failed to build workspace context:', error)
    return ''
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message, model, context }: ChatRequest = await req.json()

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
