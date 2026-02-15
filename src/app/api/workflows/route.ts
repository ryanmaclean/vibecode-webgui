/**
 * Workflow API Route Handler
 * Provides RESTful endpoints for workflow operations
 *
 * Endpoints:
 * - GET /api/workflows - List all workflows and executions
 * - POST /api/workflows - Create or execute a workflow
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getWorkflowEngine, parseWorkflowYAML } from '@/lib/workflow'
import type { WorkflowDefinition } from '@/lib/workflow/types'
import { logger } from '@/lib/logger'
import { z } from '@/lib/zod-compat'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Validation schemas
const createWorkflowSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
  config: z.record(z.any()).optional(),
  inputs: z.record(z.any()).optional(),
  outputs: z.record(z.any()).optional(),
})

const executeWorkflowSchema = z.object({
  workflowId: z.string().optional(),
  workflowYAML: z.string().optional(),
  definition: z.any().optional(),
  inputs: z.record(z.any()).optional(),
})

/**
 * GET /api/workflows
 * List all workflows and executions
 */
export async function GET(request: NextRequest) {
  try {
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

    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      logger.warn('Workflows API unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'definitions' or 'executions'
    const workflowId = searchParams.get('workflowId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const engine = getWorkflowEngine()

    // For now, return empty arrays since we don't have persistent storage yet
    // This will be enhanced when database integration is added
    const response: any = {
      definitions: [],
      executions: [],
      metadata: {
        total: 0,
        limit,
        offset,
      },
    }

    // If type is specified, filter results
    if (type === 'definitions') {
      delete response.executions
    } else if (type === 'executions') {
      delete response.definitions
    }

    logger.info('Workflows listed successfully', {
      userId: session.user.id,
      type,
      workflowId,
      status,
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Failed to list workflows', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Failed to list workflows',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workflows
 * Create a new workflow definition or execute a workflow
 */
export async function POST(request: NextRequest) {
  try {
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

    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      logger.warn('Workflows API unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'create' // 'create' or 'execute'

    if (action === 'execute') {
      // Execute a workflow
      const validation = executeWorkflowSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Invalid request',
            details: validation.error.format(),
          },
          { status: 400 }
        )
      }

      const { workflowYAML, definition, inputs = {} } = validation.data
      const engine = getWorkflowEngine()

      let workflowDef: WorkflowDefinition

      if (workflowYAML) {
        // Parse from YAML
        workflowDef = await parseWorkflowYAML(workflowYAML)
      } else if (definition) {
        // Use provided definition
        workflowDef = definition as WorkflowDefinition
      } else {
        return NextResponse.json(
          {
            error: 'Either workflowYAML or definition must be provided',
          },
          { status: 400 }
        )
      }

      // Execute workflow
      const execution = await engine.executeWorkflow(workflowDef, inputs)

      logger.info('Workflow executed successfully', {
        userId: session.user.id,
        executionId: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
      })

      // Convert Map to object for JSON serialization
      const nodesObject: Record<string, any> = {}
      execution.nodes.forEach((value, key) => {
        nodesObject[key] = {
          ...value,
          startedAt: value.startedAt?.toISOString(),
          completedAt: value.completedAt?.toISOString(),
          logs: value.logs.map(log => ({
            ...log,
            timestamp: log.timestamp.toISOString(),
          })),
        }
      })

      return NextResponse.json({
        success: true,
        execution: {
          ...execution,
          nodes: nodesObject,
          metadata: {
            ...execution.metadata,
            startedAt: execution.metadata.startedAt.toISOString(),
            completedAt: execution.metadata.completedAt?.toISOString(),
          },
          checkpoints: execution.checkpoints.map(cp => ({
            ...cp,
            timestamp: cp.timestamp.toISOString(),
          })),
        },
      })
    } else {
      // Create a new workflow definition
      const validation = createWorkflowSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Invalid workflow definition',
            details: validation.error.format(),
          },
          { status: 400 }
        )
      }

      const definition = validation.data as WorkflowDefinition
      const engine = getWorkflowEngine()

      // Validate the workflow definition
      await engine.parseWorkflow(definition)

      // In a real implementation, save to database here
      // For now, we just validate and return success

      logger.info('Workflow definition created', {
        userId: session.user.id,
        workflowName: definition.name,
        version: definition.version,
      })

      return NextResponse.json({
        success: true,
        workflow: {
          id: `${definition.name}-${definition.version}`,
          ...definition,
        },
      })
    }
  } catch (error) {
    logger.error('Failed to process workflow request', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Failed to process workflow request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
