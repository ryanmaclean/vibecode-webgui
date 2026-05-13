/**
 * AI Conversations List API Route
 * Returns conversation summaries for the current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export interface ConversationSummary {
  id: string
  title: string
  model: string
  modelProvider: 'anthropic' | 'openai' | 'google' | 'meta' | 'mistral' | 'deepseek'
  messageCount: number
  createdAt: string
  updatedAt: string
  estimatedCost: number
  archived: boolean
}

/**
 * GET /api/ai/conversations
 * Returns all conversation summaries for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Integrate with conversation storage backend
    const conversations: ConversationSummary[] = []

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Failed to retrieve conversations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
