/**
 * Container Management API
 *
 * Endpoints for managing Apple Container instances
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { appleContainer } from '@/lib/container/apple-container'
import type { ContainerOptions } from '@/lib/container/types'
import { validateRequestBody } from '@/lib/api/validation/middleware'
import { containerOptionsSchema } from '@/lib/api/validation/schemas'
import { z } from '@/lib/zod-compat'

// Define inline schema since schemas-phase4-batch2 doesn't exist
const createEnhancedContainerSchema = z.object({
  image: z.string().min(1).max(255),
  options: containerOptionsSchema.optional()
})
// import { logger } from '@/lib/logger';
/**
 * GET /api/containers
 * List all containers
 */
export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if Apple Container is available
    const isAvailable = await appleContainer.isAvailable()
    if (!isAvailable) {
      return NextResponse.json(
        { error: 'Apple Container CLI not available' },
        { status: 503 }
      )
    }

    // List containers
    const result = await appleContainer.list()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to list containers' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      containers: result.containers,
      count: result.containers.length,
    })
  } catch (error) {
    console.error('Error listing containers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/containers
 * Start a new container
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate request body
    const validation = await validateRequestBody(req, createEnhancedContainerSchema)
    if (!validation.success) {
      return validation.error as NextResponse
    }

    const { image, options } = validation.data

    // Additional security check: log container creation attempts
    console.log('Container creation attempt', {
      userId: session.user?.id,
      image,
      hasOptions: !!options,
      timestamp: new Date().toISOString()
    })

    // Check if Apple Container is available
    const isAvailable = await appleContainer.isAvailable()
    if (!isAvailable) {
      return NextResponse.json(
        { error: 'Apple Container CLI not available' },
        { status: 503 }
      )
    }

    // Start container
    const result = await appleContainer.start(image, options as ContainerOptions)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to start container' },
        { status: 500 }
      )
    }

    // Get container details
    const containerInfo = await appleContainer.inspect(result.id)

    return NextResponse.json({
      id: result.id,
      name: result.name,
      info: containerInfo,
    })
  } catch (error) {
    console.error('Error starting container:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
