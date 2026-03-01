/**
 * Individual Workspace Template API
 * Handles specific workspace template operations (get, delete)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WorkspaceTemplateService } from '@/lib/workspace-templates'
import { z } from '@/lib/zod-compat'
import { createErrorResponseFromError, ApiErrors } from '@/lib/api-utils'
import {
  createServiceLogger,
  createPerformanceTimer,
  logError,
  apiLogger
} from '@/lib/logging'
import { cacheGetOrSet, TTLPresets } from '@/lib/cache/cache-utils'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'workspace-template-api'
})

const apiRateLimit = createAPIRateLimit(60) // 60 req/min for template operations

// Zod validation schemas for template ID parameter
const TemplateIdParamSchema = z.object({
  id: z.string()
    .min(1, 'Template ID cannot be empty')
    .regex(/^\d+$/, 'Template ID must be a valid number')
    .transform(val => parseInt(val, 10))
    .refine(
      (id) => id > 0,
      'Template ID must be a positive integer'
    )
})

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * Validate template ID with comprehensive security checks
 */
function validateTemplateId(id: string): { valid: boolean; templateId?: number; error?: string } {
  try {
    const result = TemplateIdParamSchema.parse({ id })
    return { valid: true, templateId: result.id }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        error: error.issues.map(e => e.message).join(', ')
      }
    }
    return { valid: false, error: 'Validation failed' }
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now()
  const requestContext = apiLogger.logRequest(request)
  const timer = createPerformanceTimer('workspace-template-get', {
    requestId: requestContext.requestId
  })

  // Rate limiting check
  const rateLimitResult = await apiRateLimit(request)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
      },
    })
  }

  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      log.warn('Unauthorized workspace template get attempt', {
        requestId: requestContext.requestId,
        operation: 'get_workspace_template'
      })
      const response = ApiErrors.unauthorized(
        'Authentication required to access workspace template',
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const { id } = await params
    const templateIdString = id

    // Validate template ID
    const validation = validateTemplateId(templateIdString)
    if (!validation.valid || !validation.templateId) {
      log.warn('Invalid template ID in GET request', {
        templateId: templateIdString,
        error: validation.error,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userId: session.user.id,
        requestId: requestContext.requestId
      })
      const response = ApiErrors.badRequest(
        `Invalid template ID: ${validation.error}`,
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const templateId = validation.templateId

    log.info('Getting workspace template', {
      templateId,
      userId: session.user.id,
      requestId: requestContext.requestId,
      operation: 'get_workspace_template'
    })

    // Build cache key
    const cacheKey = `workspace-template:${templateId}`

    // Get template from cache or database
    const template = await cacheGetOrSet(
      cacheKey,
      async () => {
        const workspaceTemplateService = new WorkspaceTemplateService()
        return await workspaceTemplateService.getTemplate(templateId)
      },
      { ttl: TTLPresets.MEDIUM } // Cache for 5 minutes
    )

    // Check access permissions: user must own the template or it must be public
    if (!template.is_public && template.user_id !== parseInt(session.user.id, 10)) {
      log.warn('Unauthorized access to private template', {
        templateId,
        userId: session.user.id,
        templateOwnerId: template.user_id,
        requestId: requestContext.requestId
      })
      const response = ApiErrors.forbidden(
        'You do not have permission to access this template',
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const duration = timer.stop({ success: true })

    log.info('Workspace template retrieved successfully', {
      templateId,
      templateName: template.name,
      durationMs: duration,
      requestId: requestContext.requestId
    })

    const response = NextResponse.json({
      success: true,
      template,
      metadata: {
        requestId: requestContext.requestId,
        cached: false // Will be true if served from cache on subsequent requests
      }
    })

    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response

  } catch (error) {
    timer.stop({ success: false })

    logError(error, {
      operation: 'get_workspace_template',
      requestId: requestContext.requestId,
      component: 'workspace-template-api'
    })

    // Handle template not found
    if (error instanceof Error && error.message.includes('Template not found')) {
      const response = ApiErrors.notFound(
        'Template not found',
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    // Handle other errors
    const response = createErrorResponseFromError(
      error,
      500,
      'Failed to get workspace template',
      requestContext.requestId
    )
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now()
  const requestContext = apiLogger.logRequest(request)
  const timer = createPerformanceTimer('workspace-template-delete', {
    requestId: requestContext.requestId
  })

  // Rate limiting check
  const rateLimitResult = await apiRateLimit(request)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
      },
    })
  }

  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      log.warn('Unauthorized workspace template delete attempt', {
        requestId: requestContext.requestId,
        operation: 'delete_workspace_template'
      })
      const response = ApiErrors.unauthorized(
        'Authentication required to delete workspace template',
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const { id } = await params
    const templateIdString = id

    // Validate template ID with enhanced logging for destructive operations
    const validation = validateTemplateId(templateIdString)
    if (!validation.valid || !validation.templateId) {
      log.warn('Invalid template ID in DELETE request', {
        templateId: templateIdString,
        error: validation.error,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        severity: 'high',
        userId: session.user.id,
        requestId: requestContext.requestId
      })
      const response = ApiErrors.badRequest(
        `Invalid template ID: ${validation.error}`,
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    const templateId = validation.templateId

    log.info('Deleting workspace template', {
      templateId,
      userId: session.user.id,
      requestId: requestContext.requestId,
      operation: 'delete_workspace_template'
    })

    // Get the template to check ownership
    const workspaceTemplateService = new WorkspaceTemplateService()
    const template = await workspaceTemplateService.getTemplate(templateId)

    // Check ownership: only the template owner can delete
    if (template.user_id !== parseInt(session.user.id, 10)) {
      log.warn('Unauthorized template deletion attempt', {
        templateId,
        userId: session.user.id,
        templateOwnerId: template.user_id,
        severity: 'high',
        requestId: requestContext.requestId
      })
      const response = ApiErrors.forbidden(
        'You do not have permission to delete this template',
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    // Delete the template
    await workspaceTemplateService.deleteTemplate(templateId)

    const duration = timer.stop({ success: true })

    log.info('Workspace template deleted successfully', {
      templateId,
      templateName: template.name,
      durationMs: duration,
      requestId: requestContext.requestId
    })

    const response = NextResponse.json({
      success: true,
      message: `Template ${template.name} deleted successfully`,
      metadata: {
        requestId: requestContext.requestId
      }
    })

    response.headers.set('x-request-id', requestContext.requestId)
    apiLogger.logResponse(requestContext, response, startTime)
    return response

  } catch (error) {
    timer.stop({ success: false })

    logError(error, {
      operation: 'delete_workspace_template',
      requestId: requestContext.requestId,
      component: 'workspace-template-api'
    })

    // Handle template not found
    if (error instanceof Error && error.message.includes('Template not found')) {
      const response = ApiErrors.notFound(
        'Template not found',
        requestContext.requestId
      )
      apiLogger.logResponse(requestContext, response, startTime)
      return response
    }

    // Handle other errors
    const response = createErrorResponseFromError(
      error,
      500,
      'Failed to delete workspace template',
      requestContext.requestId
    )
    apiLogger.logResponse(requestContext, response, startTime)
    return response
  }
}
