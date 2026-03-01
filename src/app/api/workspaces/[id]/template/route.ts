/**
 * Save Workspace as Template API
 * Handles saving an existing workspace as a reusable template
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WorkspaceTemplateService } from '@/lib/workspace-templates'
import { z } from '@/lib/zod-compat'

export const dynamic = 'force-dynamic'

// Zod validation schemas for workspace ID parameter
const WorkspaceIdParamSchema = z.object({
  id: z.string()
    .min(1, 'Workspace ID cannot be empty')
    .max(64, 'Workspace ID cannot exceed 64 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Workspace ID must contain only alphanumeric characters, hyphens, and underscores'
    )
    .refine(
      (id) => !id.includes('..') && !id.startsWith('.') && !id.endsWith('.'),
      'Workspace ID contains invalid path traversal patterns'
    )
})

// Zod validation schema for POST request body
const SaveTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Template name is required')
    .max(255, 'Template name cannot exceed 255 characters'),
  description: z.string()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional(),
  is_public: z.boolean().default(false),
  tags: z.string().optional(),
  framework: z.string().optional(),
  language: z.string().optional()
}).strict()

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * Validate workspace ID with comprehensive security checks
 */
function validateWorkspaceId(id: string): { valid: boolean; error?: string } {
  try {
    WorkspaceIdParamSchema.parse({ id })
    return { valid: true }
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

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required to save workspace as template' },
        { status: 401 }
      )
    }

    const { id } = await params
    const workspaceId = id

    // Validate workspace ID
    const validation = validateWorkspaceId(workspaceId)
    if (!validation.valid) {
      console.warn('Invalid workspace ID in POST template request', {
        workspaceId,
        error: validation.error,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userId: session.user.id
      })
      return NextResponse.json(
        { error: 'Invalid workspace ID', details: validation.error },
        { status: 400 }
      )
    }

    // Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Validate template payload
    const templateValidation = SaveTemplateSchema.safeParse(body)
    if (!templateValidation.success) {
      console.warn('Invalid template payload', {
        workspaceId,
        errors: templateValidation.error.issues,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userId: session.user.id
      })
      return NextResponse.json(
        {
          error: 'Invalid template payload',
          details: templateValidation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      )
    }

    const templateData = templateValidation.data

    console.info('Saving workspace as template', {
      workspaceId,
      templateName: templateData.name,
      isPublic: templateData.is_public,
      userId: session.user.id
    })

    // Initialize template service
    const templateService = new WorkspaceTemplateService()

    // Save workspace as template
    const template = await templateService.saveAsTemplate(workspaceId, {
      name: templateData.name,
      description: templateData.description,
      userId: parseInt(session.user.id),
      isPublic: templateData.is_public,
      tags: templateData.tags,
      framework: templateData.framework,
      language: templateData.language
    })

    console.info(`✅ Workspace saved as template: ${template.id}`, {
      workspaceId,
      templateId: template.id,
      templateName: template.name
    })

    return NextResponse.json({
      success: true,
      message: 'Workspace saved as template successfully',
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        is_public: template.is_public,
        tags: template.tags,
        framework: template.framework,
        language: template.language,
        created_at: template.created_at
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Failed to save workspace as template', { error })

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('Workspace not found')) {
        return NextResponse.json(
          { error: 'Workspace not found', message: error.message },
          { status: 404 }
        )
      }

      if (error.message.includes('Template name')) {
        return NextResponse.json(
          { error: 'Invalid template name', message: error.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to save workspace as template',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
