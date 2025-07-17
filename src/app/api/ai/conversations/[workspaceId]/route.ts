// Conversation Persistence API - Save and load chat history per workspace
// Enables persistent conversations across sessions

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  metadata?: {
    model?: string
    context?: string[]
    tokens?: number
    responseTime?: number
  }
}

interface Conversation {
  workspaceId: string
  messages: Message[]
  lastUpdated: string
  metadata: {
    totalMessages: number
    modelUsage: Record<string, number>
    totalTokens: number
  }
}

// Get conversations directory path
function getConversationsDir() {
  return path.join(process.cwd(), 'data', 'conversations')
}

function getConversationPath(workspaceId: string) {
  return path.join(getConversationsDir(), `${workspaceId}.json`)
}

// Ensure conversations directory exists
async function ensureConversationsDir() {
  const dir = getConversationsDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

// GET - Load conversation history
export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = params

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    await ensureConversationsDir()
    const conversationPath = getConversationPath(workspaceId)

    // Check if conversation file exists
    if (!existsSync(conversationPath)) {
      // Return empty conversation
      const emptyConversation: Conversation = {
        workspaceId,
        messages: [],
        lastUpdated: new Date().toISOString(),
        metadata: {
          totalMessages: 0,
          modelUsage: {},
          totalTokens: 0
        }
      }
      return NextResponse.json(emptyConversation)
    }

    // Read and return conversation
    const conversationData = await readFile(conversationPath, 'utf-8')
    const conversation: Conversation = JSON.parse(conversationData)

    return NextResponse.json(conversation)

  } catch (error) {
    console.error('Failed to load conversation:', error)
    return NextResponse.json(
      {
        error: 'Failed to load conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST - Save conversation history
export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = params
    const body = await request.json()

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    await ensureConversationsDir()

    // Calculate metadata
    const modelUsage: Record<string, number> = {}
    let totalTokens = 0

    body.messages.forEach((msg: Message) => {
      if (msg.metadata?.model) {
        modelUsage[msg.metadata.model] = (modelUsage[msg.metadata.model] || 0) + 1
      }
      if (msg.metadata?.tokens) {
        totalTokens += msg.metadata.tokens
      }
    })

    // Create conversation object
    const conversation: Conversation = {
      workspaceId,
      messages: body.messages,
      lastUpdated: new Date().toISOString(),
      metadata: {
        totalMessages: body.messages.length,
        modelUsage,
        totalTokens
      }
    }

    // Save conversation
    const conversationPath = getConversationPath(workspaceId)
    await writeFile(conversationPath, JSON.stringify(conversation, null, 2))

    return NextResponse.json({
      success: true,
      messagesCount: body.messages.length,
      lastUpdated: conversation.lastUpdated
    })

  } catch (error) {
    console.error('Failed to save conversation:', error)
    return NextResponse.json(
      {
        error: 'Failed to save conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE - Clear conversation history
export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = params

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    const conversationPath = getConversationPath(workspaceId)

    // Check if file exists before trying to delete
    if (existsSync(conversationPath)) {
      const { unlink } = await import('fs/promises')
      await unlink(conversationPath)
    }

    return NextResponse.json({
      success: true,
      message: 'Conversation cleared'
    })

  } catch (error) {
    console.error('Failed to clear conversation:', error)
    return NextResponse.json(
      {
        error: 'Failed to clear conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
