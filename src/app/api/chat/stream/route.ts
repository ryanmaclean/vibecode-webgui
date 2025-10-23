import { NextRequest, NextResponse } from 'next/server'
import { mongodbChatService } from '@/lib/services/chat-mongodb'
import { enhancedRAGService, RAGContext } from '@/lib/services/rag-enhanced'
import { datadogMetrics } from '@/lib/monitoring/datadog-metrics'
import { getToken } from 'next-auth/jwt'
import { logger } from '@/lib/monitoring'
import { chatStreamSchema } from '@/lib/api/validation/schemas'
import { z } from '@/lib/zod-compat'

// Streaming chat endpoint with MongoDB persistence
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let statusCode = 200
  let userId = 'anonymous'
  
  try {
    // Get authentication token or use development bypass
    const token = await getToken({ req: request })
    const testUserId = request.headers.get('x-test-user-id')
    
    if (!token?.sub && !testUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    userId = token?.sub || testUserId || 'anonymous'

    // Validate request body with Zod
    let validatedData
    try {
      const body = await request.json()
      validatedData = chatStreamSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid request parameters',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          },
          { status: 400 }
        )
      }
      throw error
    }

    const {
      conversationId,
      message,
      model,
      workspaceId,
      files,
      enableWebSearch,
      enableRAG
    } = validatedData

    // Validate session and conversation
    let conversation = await mongodbChatService.getConversation(conversationId)
    
    if (!conversation) {
      // Create new conversation if it doesn't exist
      conversation = await mongodbChatService.createConversation(
        message.slice(0, 100) + (message.length > 100 ? '...' : ''),
        `session-${Date.now()}`,
        model,
        userId,
        workspaceId
      )
    }

    // Add user message to MongoDB
    const userMessage = await mongodbChatService.addMessage(conversationId, {
      content: message,
      from: 'user',
      files: files.length > 0 ? files : undefined
    })

    // Build RAG context if enabled
    let ragContext: RAGContext | null = null
    if (enableRAG || enableWebSearch) {
      const ragStartTime = Date.now()
      try {
        ragContext = await enhancedRAGService.buildContext({
          query: message,
          workspaceId,
          includeWebSearch: enableWebSearch,
          maxFileResults: 5,
          maxWebResults: 3
        })
        
        const ragDuration = Date.now() - ragStartTime
        
        // Record RAG metrics
        if (ragContext) {
          datadogMetrics.recordRAGContext(
            ragDuration,
            ragContext.sources.length,
            ragContext.relevanceScore,
            { tags: { user_id: userId, workspace_id: workspaceId } }
          )
          
          logger.info('RAG context built', {
            service: 'enhanced-rag',
            sourcesCount: ragContext.sources.length,
            webResultsCount: ragContext.webResults?.length || 0,
            relevanceScore: ragContext.relevanceScore,
            conversationId
          })
        }
      } catch (error) {
        datadogMetrics.recordError('rag_context_failed', 'rag', '/api/chat/stream')
        logger.warn('RAG context building failed, continuing without context', {
          service: 'enhanced-rag',
          error: error instanceof Error ? error.message : String(error),
          conversationId
        })
      }
    }

    // Create streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Record user action
          datadogMetrics.recordUserAction('chat_message', userId, workspaceId)
          
          // Call OpenRouter API for streaming response
          const llmStartTime = Date.now()
          const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'X-Title': 'VibeCode WebGUI',
              'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'system',
                  content: ragContext ? 
                    `You are a helpful AI assistant integrated with VibeCode WebGUI. You have access to the user's workspace and can help with development tasks, code review, and general questions. Use the following context to provide more accurate and relevant responses:\n\n${enhancedRAGService.formatContextForPrompt(ragContext)}` :
                    'You are a helpful AI assistant integrated with VibeCode WebGUI. You have access to the user\'s workspace and can help with development tasks, code review, and general questions.'
                },
                ...conversation.messages.slice(-10).map(msg => ({ // Last 10 messages for context
                  role: msg.from === 'user' ? 'user' : 'assistant',
                  content: msg.content
                })),
                {
                  role: 'user',
                  content: message
                }
              ],
              stream: true,
              temperature: 0.7,
              max_tokens: 4000
            })
          })

          if (!openRouterResponse.ok) {
            throw new Error(`OpenRouter API error: ${openRouterResponse.status}`)
          }

          const reader = openRouterResponse.body?.getReader()
          if (!reader) {
            throw new Error('No response body from OpenRouter')
          }

          let assistantResponse = ''
          const decoder = new TextDecoder()

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value)
              const lines = chunk.split('\n').filter(line => line.trim())

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  if (data === '[DONE]') {
                    // Record chat processing metrics
                    const chatDuration = Date.now() - llmStartTime
                    datadogMetrics.recordChatProcessing(
                      chatDuration,
                      model,
                      message.length,
                      { tags: { user_id: userId, workspace_id: workspaceId } }
                    )
                    
                    // Save assistant response to MongoDB
                    await mongodbChatService.addMessage(conversationId, {
                      content: assistantResponse,
                      from: 'assistant'
                    })

                    // Send final metadata including RAG info
                    const metadata: any = {
                      type: 'metadata',
                      conversationId: conversation.id,
                      userMessageId: userMessage.id,
                      totalMessages: conversation.messages.length + 2,
                      model,
                      ragEnabled: enableRAG,
                      webSearchEnabled: enableWebSearch
                    }

                    if (ragContext) {
                      metadata.ragSources = ragContext.sources.map(s => s.metadata.title || s.id)
                      metadata.webSearchResults = ragContext.webResults?.map(w => ({ title: w.title, url: w.url }))
                      metadata.relevanceScore = ragContext.relevanceScore
                      metadata.contextTokens = ragContext.totalTokens
                    }

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`))

                    controller.close()
                    return
                  }

                  try {
                    const parsed = JSON.parse(data)
                    if (parsed.choices?.[0]?.delta?.content) {
                      const content = parsed.choices[0].delta.content
                      assistantResponse += content
                      
                      // Stream the chunk to client
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'content',
                        content
                      })}\n\n`))
                    }
                  } catch (e) {
                    // Skip invalid JSON
                    continue
                  }
                }
              }
            }
          } finally {
            reader.releaseLock()
          }
        } catch (error) {
          statusCode = 500
          datadogMetrics.recordError('chat_stream_error', 'chat', '/api/chat/stream')
          
          logger.error('Streaming chat error', {
            service: 'mongodb-chat-stream',
            error: error instanceof Error ? error.message : String(error),
            conversationId,
            userId
          })

          // Send error to client
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : String(error)
          })}\n\n`))

          controller.close()
        } finally {
          // Record API response time
          const responseTime = Date.now() - startTime
          datadogMetrics.recordResponseTime(responseTime, '/api/chat/stream', 'POST', statusCode)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/stream-event',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    statusCode = 500
    const responseTime = Date.now() - startTime
    
    datadogMetrics.recordError('chat_stream_api_error', 'api', '/api/chat/stream')
    datadogMetrics.recordResponseTime(responseTime, '/api/chat/stream', 'POST', statusCode)
    
    logger.error('Chat Stream API Error', {
      service: 'vibecode-webgui',
      error: error instanceof Error ? error.message : String(error),
      userId: userId
    })

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}