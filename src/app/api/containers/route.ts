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
import { createContainerSchema } from '@/lib/api/validation/schemas'
import { createServiceLogger } from '@/lib/logging'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const apiRateLimit = createAPIRateLimit(60)

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'api-containers'
})
/**
 * GET /api/containers
 * List all containers
 */
export async function GET(req: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResult = await apiRateLimit(req)
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
    log.error('Failed to list containers', { error: error instanceof Error ? error.message : String(error) })
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
    // Check rate limit
    const rateLimitResult = await apiRateLimit(req)
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

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate request body
    const validation = await validateRequestBody(req, createContainerSchema)
    if (!validation.success) {
      return validation.error as NextResponse
    }

    const { image, options } = validation.data

    // Security audit: log container creation attempts
    log.info('Container creation attempt', {
      userId: session.user?.id,
      image,
      hasOptions: !!options
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
    log.error('Failed to start container', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
