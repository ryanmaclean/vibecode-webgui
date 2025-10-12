/**
 * Individual Container Management API
 *
 * Endpoints for managing a specific container
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { appleContainer } from '@/lib/container/apple-container'
import { validatePathParams } from '@/lib/api/validation/middleware'
import { containerIdSchema } from '@/lib/api/validation/schemas'
import { logger } from '@/lib/logger';
/**
 * GET /api/containers/[id]
 * Get container details or logs
 *
 * Query params:
 * - logs=true: Get container logs instead of details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate path parameters
    const validation = validatePathParams(params, containerIdSchema)
    if (!validation.success) {
      return validation.error as NextResponse
    }

    const { id: containerId } = validation.data
    const { searchParams } = new URL(req.url)
    const getLogs = searchParams.get('logs') === 'true'

    // Return logs if requested
    if (getLogs) {
      const logsResult = await appleContainer.logs(containerId)

      if (!logsResult.success) {
        return NextResponse.json(
          { error: logsResult.error || 'Failed to get logs' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        logs: logsResult.logs,
        containerId,
      })
    }

    // Get container info
    const containerInfo = await appleContainer.inspect(containerId)

    if (!containerInfo) {
      return NextResponse.json(
        { error: 'Container not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(containerInfo)
  } catch (error) {
    logger.error('Error getting container:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/containers/[id]
 * Stop and remove a container
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate path parameters
    const validation = validatePathParams(params, containerIdSchema)
    if (!validation.success) {
      return validation.error as NextResponse
    }

    const { id: containerId } = validation.data

    // Stop container first
    const stopResult = await appleContainer.stop(containerId)

    if (!stopResult.success) {
      // Container might already be stopped, continue to remove
      logger.warn('Failed to stop container:', stopResult.error)
    }

    // Remove container
    const removeResult = await appleContainer.remove(containerId)

    if (!removeResult.success) {
      return NextResponse.json(
        { error: removeResult.error || 'Failed to remove container' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Container stopped and removed',
    })
  } catch (error) {
    logger.error('Error deleting container:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
