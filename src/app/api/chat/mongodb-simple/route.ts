import { NextRequest, NextResponse } from 'next/server'
import { connectToMongoDB } from '@/lib/mongodb'
import { v4 as uuidv4 } from 'uuid'
import { mongodbChatActionSchema } from '@/lib/api/validation/schemas'
import { z } from '@/lib/zod-compat'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import type { PushOperator, Document } from 'mongodb'

export const dynamic = 'force-dynamic'

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

// Simple MongoDB chat test without complex service layer
export async function POST(request: NextRequest) {
  // Rate limiting
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

  try {
    // Development testing bypass
    const testUserId = request.headers.get('x-test-user-id')
    if (!testUserId && process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        { error: 'x-test-user-id header required for testing' },
        { status: 401 }
      )
    }

    const userId = testUserId || 'anonymous'

    // Validate request body with Zod
    let validatedData
    try {
      const body = await request.json()
      validatedData = mongodbChatActionSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid request parameters',
            details: error.issues.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          },
          { status: 400 }
        )
      }
      throw error
    }

    const { db } = await connectToMongoDB()

    switch (validatedData.action) {
      case 'create_session':
        const session = {
          sessionId: uuidv4(),
          userId,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
        
        const sessionResult = await db.collection('sessions').insertOne(session)
        
        return NextResponse.json({
          success: true,
          session: {
            ...session,
            _id: sessionResult.insertedId
          }
        })

      case 'create_conversation':
        const { title, sessionId, model, workspaceId } = validatedData
        
        const conversation = {
          id: uuidv4(),
          title: title || 'New Conversation',
          sessionId,
          model,
          userId,
          workspaceId,
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: []
        }
        
        const convResult = await db.collection('conversations').insertOne(conversation)
        
        return NextResponse.json({
          success: true,
          conversation: {
            ...conversation,
            _id: convResult.insertedId
          }
        })

      case 'add_message':
        const { conversationId, content, from } = validatedData
        
        const message = {
          id: uuidv4(),
          from,
          content,
          createdAt: new Date()
        }
        
        const updateResult = await db.collection('conversations').updateOne(
          { id: conversationId },
          {
            $push: { messages: message } as unknown as PushOperator<Document>,
            $set: { updatedAt: new Date() }
          }
        )
        
        if (updateResult.matchedCount === 0) {
          return NextResponse.json(
            { error: 'Conversation not found' },
            { status: 404 }
          )
        }
        
        return NextResponse.json({
          success: true,
          message
        })

      case 'get_conversations':
        const conversations = await db.collection('conversations')
          .find({ userId })
          .sort({ updatedAt: -1 })
          .limit(20)
          .toArray()
        
        return NextResponse.json({
          success: true,
          conversations
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
        break;
    }
  } catch (error) {
    // Server error logged
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
  // Rate limiting
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

  try {
    const testUserId = request.headers.get('x-test-user-id')
    if (!testUserId && process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        { error: 'x-test-user-id header required for testing' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'health') {
      const { db } = await connectToMongoDB()
      
      // Test operations
      const testDoc = {
        test: true,
        timestamp: new Date()
      }
      
      const insertResult = await db.collection('health_test').insertOne(testDoc)
      await db.collection('health_test').deleteOne({ _id: insertResult.insertedId })
      
      return NextResponse.json({
        success: true,
        mongodb: {
          status: 'healthy',
          database: db.databaseName,
          testCompleted: true
        }
      })
    }

    return NextResponse.json(
      { error: 'Invalid action parameter' },
      { status: 400 }
    )
  } catch (error) {
    // Server error logged
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}