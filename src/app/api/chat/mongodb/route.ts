import { NextRequest, NextResponse } from 'next/server'
import { mongodbChatService } from '@/lib/services/chat-mongodb'
import { getToken } from 'next-auth/jwt'
import { logger } from '@/lib/monitoring'
import { z } from '@/lib/zod-compat'
import { validateRequestBody } from '@/lib/api/validation/middleware'

// Chat request validation schema
const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000).regex(/^[^\x00-\x1F\x7F]*$/, 'Message contains invalid characters'),
  conversationId: z.string().optional(),
  model: z.string().optional().default('gpt-4'),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().min(1).max(4000).optional().default(1000),
  stream: z.boolean().optional().default(false)
})

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const validation = await validateRequestBody(request, chatRequestSchema)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error },
        { status: 400 }
      )
    }

    const { message, conversationId, model, temperature, maxTokens, stream } = validation.data

    // Get authentication token with development bypass support
    let token = await getToken({ req: request })
    
    // Development testing bypass
    if (!token && process.env.NODE_ENV === 'development') {
      const testUserId = request.headers.get('x-test-user-id')
      const testUserRole = request.headers.get('x-test-user-role')
      
      if (testUserId) {
        token = {
          sub: testUserId,
          id: testUserId,
          role: testUserRole || 'developer',
          email: `test-${testUserId}@vibecode.dev`,
          name: `Test User ${testUserId}`
        } as any
      }
    }
    
    if (!token?.sub) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'create_session':
        const session = await mongodbChatService.createSession(
          token.sub,
          request.headers.get('user-agent') || undefined,
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
        )
        return NextResponse.json({ success: true, session })

      case 'create_conversation':
        const { title, sessionId, model, workspaceId } = data
        const conversation = await mongodbChatService.createConversation(
          title,
          sessionId,
          model,
          token.sub,
          workspaceId
        )
        return NextResponse.json({ success: true, conversation })

      case 'add_message':
        const { conversationId, content, from, files } = data
        const message = await mongodbChatService.addMessage(conversationId, {
          content,
          from,
          files
        })
        return NextResponse.json({ success: true, message })

      case 'get_conversations':
        const { workspaceId: wsId, limit } = data
        const conversations = wsId 
          ? await mongodbChatService.getConversationsByWorkspace(wsId, limit)
          : await mongodbChatService.getConversationsByUser(token.sub, limit)
        return NextResponse.json({ success: true, conversations })

      case 'get_conversation':
        const { conversationId: convId } = data
        const conv = await mongodbChatService.getConversation(convId)
        if (!conv) {
          return NextResponse.json(
            { error: 'Conversation not found' },
            { status: 404 }
          )
        }
        return NextResponse.json({ success: true, conversation: conv })

      case 'search_conversations':
        const { query, workspaceId: searchWsId, searchLimit = 20 } = data
        const searchResults = await mongodbChatService.searchConversations(
          query,
          token.sub,
          searchWsId,
          searchLimit
        )
        return NextResponse.json({ success: true, conversations: searchResults })

      case 'get_stats':
        const { workspaceId: statsWsId } = data
        const stats = await mongodbChatService.getConversationStats(token.sub, statsWsId)
        return NextResponse.json({ success: true, stats })

      case 'create_assistant':
        const { name, description, instructions, assistantModel, tools, assistantFiles } = data
        const assistant = await mongodbChatService.createAssistant(
          name,
          description,
          instructions,
          assistantModel,
          token.sub,
          tools,
          assistantFiles
        )
        return NextResponse.json({ success: true, assistant })

      case 'get_assistants':
        const assistants = await mongodbChatService.getAssistantsByUser(token.sub)
        return NextResponse.json({ success: true, assistants })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    logger.error('MongoDB Chat API Error', {
      service: 'vibecode-webgui',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
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

export async function GET(request: NextRequest) {
  try {
    // Get authentication token with development bypass support
    let token = await getToken({ req: request })
    
    // Development testing bypass
    if (!token && process.env.NODE_ENV === 'development') {
      const testUserId = request.headers.get('x-test-user-id')
      const testUserRole = request.headers.get('x-test-user-role')
      
      if (testUserId) {
        token = {
          sub: testUserId,
          id: testUserId,
          role: testUserRole || 'developer',
          email: `test-${testUserId}@vibecode.dev`,
          name: `Test User ${testUserId}`
        } as any
      }
    }
    
    if (!token?.sub) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'health':
        // Test MongoDB connection
        try {
          const testSession = await mongodbChatService.createSession('health-check')
          // Don't cleanup immediately, let it expire naturally
          
          return NextResponse.json({
            success: true,
            mongodb: {
              status: 'healthy',
              connection: 'active',
              collections: ['conversations', 'sessions', 'assistants'],
              testSessionId: testSession.sessionId
            }
          })
        } catch (mongoError) {
          logger.error('MongoDB health check failed', {
            service: 'mongodb-chat-health',
            error: mongoError instanceof Error ? mongoError.message : String(mongoError)
          })
          
          return NextResponse.json({
            success: false,
            mongodb: {
              status: 'error',
              error: mongoError instanceof Error ? mongoError.message : String(mongoError)
            }
          })
        }

      case 'cleanup':
        const deletedCount = await mongodbChatService.cleanupExpiredSessions()
        return NextResponse.json({
          success: true,
          message: `Cleaned up ${deletedCount} expired sessions`
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        )
    }
  } catch (error) {
    logger.error('MongoDB Chat GET API Error', {
      service: 'vibecode-webgui',
      error: error instanceof Error ? error.message : String(error)
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