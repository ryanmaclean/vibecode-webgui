/**
 * Container Management API
 *
 * Endpoints for managing containers using the unified runtime interface
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRuntimeWithFallback } from '@/lib/container/runtime-factory'
import type { ContainerOptions } from '@/lib/container/runtime-interface'
import { validateRequestBody } from '@/lib/api/validation/middleware'
import { createContainerSchema } from '@/lib/api/validation/schemas'

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

    // Get runtime
    const runtime = await getRuntimeWithFallback()
    
    // Check if runtime is available
    const isAvailable = await runtime.isAvailable()
    if (!isAvailable) {
      return NextResponse.json(
        { error: `Container runtime ${runtime.name} not available` },
        { status: 503 }
      )
    }

    // List containers
    const result = await runtime.list({ all: true })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to list containers' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      runtime: runtime.name,
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
    const validation = await validateRequestBody(req, createContainerSchema)
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

    // Get runtime
    const runtime = await getRuntimeWithFallback()

    // Check if runtime is available
    const isAvailable = await runtime.isAvailable()
    if (!isAvailable) {
      return NextResponse.json(
        { error: `Container runtime ${runtime.name} not available` },
        { status: 503 }
      )
    }

    // Start container
    const result = await runtime.start(image, options as ContainerOptions)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to start container' },
        { status: 500 }
      )
    }

    // Get container details
    const containerInfo = await runtime.inspect(result.id!)

    return NextResponse.json({
      runtime: runtime.name,
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
