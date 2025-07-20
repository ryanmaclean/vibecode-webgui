/**
 * Vector Search API for RAG functionality
 * Provides semantic search across uploaded files
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { vectorStore } from '@/lib/vector-store'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  workspaceId: z.string().optional(),
  fileIds: z.array(z.number()).optional(),
  limit: z.number().min(1).max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.7),
})

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

    const body = await request.json()
    const { query, workspaceId, fileIds, limit, threshold } = searchSchema.parse(body)

    // Verify workspace access if provided
    let workspace = null
    if (workspaceId) {
      workspace = await prisma.workspace.findFirst({
        where: {
          workspace_id: workspaceId,
          user_id: parseInt(session.user.id)
        }
      })

      if (!workspace) {
        return NextResponse.json(
          { error: 'Workspace not found or access denied' },
          { status: 404 }
        )
      }
    }

    // Perform vector search
    const searchResults = await vectorStore.search(query, {
      workspaceId: workspace?.id,
      fileIds,
      limit,
      threshold
    })

    // Get context for AI prompt
    const context = await vectorStore.getContext(query, workspace?.id)

    return NextResponse.json({
      success: true,
      query,
      results: searchResults.map(result => ({
        content: result.chunk.content,
        similarity: result.similarity,
        metadata: result.chunk.metadata
      })),
      context,
      stats: {
        totalResults: searchResults.length,
        averageSimilarity: searchResults.length > 0 
          ? searchResults.reduce((sum, r) => sum + r.similarity, 0) / searchResults.length 
          : 0
      }
    })

  } catch (error) {
    console.error('Vector search error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to perform search',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint for vector store statistics
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const workspaceId = url.searchParams.get('workspaceId')

    // Get vector store statistics
    const stats = await vectorStore.getStats()

    // Get user-specific stats
    const userStats = await prisma.file.aggregate({
      where: {
        user_id: parseInt(session.user.id),
        ...(workspaceId && {
          workspace: {
            workspace_id: workspaceId
          }
        })
      },
      _count: true,
      _sum: {
        size: true
      }
    })

    const ragChunksCount = await prisma.rAGChunk.count({
      where: {
        file: {
          user_id: parseInt(session.user.id),
          ...(workspaceId && {
            workspace: {
              workspace_id: workspaceId
            }
          })
        }
      }
    })

    return NextResponse.json({
      success: true,
      globalStats: stats,
      userStats: {
        totalFiles: userStats._count,
        totalSize: userStats._sum.size || 0,
        totalChunks: ragChunksCount,
        vectorSearchEnabled: process.env.OPENROUTER_API_KEY ? true : false
      }
    })

  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}