/**
 * Workspace Template Service
 *
 * Service for managing workspace templates - saving workspace configurations
 * as templates and creating new workspaces from templates.
 *
 * This service provides CRUD operations for workspace templates including:
 * - Saving existing workspaces as reusable templates
 * - Listing user's private templates and public templates
 * - Retrieving specific template details
 * - Deleting templates (owner only)
 * - Cloning workspaces from templates
 *
 * @module workspace-templates
 *
 * @example
 * ```typescript
 * import { WorkspaceTemplateService } from '@/lib/workspace-templates';
 *
 * const service = new WorkspaceTemplateService();
 *
 * // Save a workspace as a template
 * const template = await service.saveAsTemplate('workspace-id', {
 *   name: 'React TypeScript Starter',
 *   description: 'React app with TypeScript and ESLint',
 *   userId: 1,
 *   isPublic: true,
 *   tags: 'react,typescript,eslint'
 * });
 *
 * // List templates
 * const templates = await service.listTemplates(1, false);
 *
 * // Get specific template
 * const template = await service.getTemplate(123);
 *
 * // Clone from template
 * const workspace = await service.cloneFromTemplate(123, 1);
 *
 * // Delete template
 * await service.deleteTemplate(123);
 * ```
 */

import { z } from '@/lib/zod-compat'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/**
 * Zod schema for validating template save requests.
 * Ensures all required fields are present and correctly typed.
 */
const SaveTemplateRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  userId: z.number().int().positive(),
  isPublic: z.boolean().default(false),
  tags: z.string().optional(),
  framework: z.string().optional(),
  language: z.string().optional()
})

/**
 * Zod schema for validating template list filter options.
 * Used for filtering templates by various criteria.
 */
const ListTemplatesOptionsSchema = z.object({
  userId: z.number().int().positive().optional(),
  isPublic: z.boolean().optional(),
  framework: z.string().optional(),
  language: z.string().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0)
})

/**
 * Zod schema for workspace template response.
 * Defines the structure of template data returned from the service.
 */
const WorkspaceTemplateSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  user_id: z.number().int(),
  workspace_config: z.record(z.unknown()),
  is_public: z.boolean(),
  tags: z.string().nullable(),
  framework: z.string().nullable(),
  language: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date()
})

/**
 * Type representing a request to save a workspace as a template.
 * Inferred from SaveTemplateRequestSchema for type safety.
 *
 * @typedef SaveTemplateRequest
 * @property name - Template name (1-255 characters)
 * @property description - Optional template description
 * @property userId - ID of the user creating the template
 * @property isPublic - Whether template is public (default: false)
 * @property tags - Optional comma-separated tags
 * @property framework - Optional framework identifier (e.g., 'react', 'vue')
 * @property language - Optional language identifier (e.g., 'typescript', 'javascript')
 */
export type SaveTemplateRequest = z.infer<typeof SaveTemplateRequestSchema>

/**
 * Type representing template listing filter options.
 * Inferred from ListTemplatesOptionsSchema for type safety.
 *
 * @typedef ListTemplatesOptions
 * @property userId - Optional user ID to filter by owner
 * @property isPublic - Optional flag to filter by public/private
 * @property framework - Optional framework to filter by
 * @property language - Optional language to filter by
 * @property limit - Maximum number of results (default: 50)
 * @property offset - Number of results to skip (default: 0)
 */
export type ListTemplatesOptions = z.infer<typeof ListTemplatesOptionsSchema>

/**
 * Type representing a workspace template.
 * Inferred from WorkspaceTemplateSchema for type safety.
 *
 * @typedef WorkspaceTemplate
 * @property id - Unique template identifier
 * @property name - Template name
 * @property description - Template description (nullable)
 * @property user_id - Owner user ID
 * @property workspace_config - Workspace configuration JSON
 * @property is_public - Whether template is publicly accessible
 * @property tags - Comma-separated tags (nullable)
 * @property framework - Framework identifier (nullable)
 * @property language - Language identifier (nullable)
 * @property created_at - Creation timestamp
 * @property updated_at - Last update timestamp
 */
export type WorkspaceTemplate = z.infer<typeof WorkspaceTemplateSchema>

/**
 * Workspace template service for managing reusable workspace configurations.
 * Provides CRUD operations for workspace templates and cloning functionality.
 *
 * @class WorkspaceTemplateService
 *
 * @example
 * ```typescript
 * const service = new WorkspaceTemplateService();
 *
 * // Save workspace as template
 * const template = await service.saveAsTemplate('ws-123', {
 *   name: 'My Template',
 *   description: 'A great starter template',
 *   userId: 1,
 *   isPublic: true,
 *   tags: 'starter,react',
 *   framework: 'react',
 *   language: 'typescript'
 * });
 * ```
 */
export class WorkspaceTemplateService {
  /**
   * Creates a new WorkspaceTemplateService instance.
   */
  constructor() {
    console.info('🔧 WorkspaceTemplateService initialized')
  }

  /**
   * Saves an existing workspace as a reusable template.
   * Extracts the workspace configuration and creates a template record.
   *
   * @param workspaceId - The workspace ID to save as template
   * @param request - Template creation request data
   * @param request.name - Template name (1-255 characters)
   * @param request.description - Optional description
   * @param request.userId - User ID creating the template
   * @param request.isPublic - Whether template should be public
   * @param request.tags - Optional comma-separated tags
   * @param request.framework - Optional framework identifier
   * @param request.language - Optional language identifier
   * @returns Promise resolving to the created template
   * @throws ZodError if the request fails validation
   * @throws Error if workspace not found or database operation fails
   *
   * @example
   * ```typescript
   * const template = await service.saveAsTemplate('ws-123', {
   *   name: 'React Starter',
   *   description: 'Basic React app setup',
   *   userId: 1,
   *   isPublic: true,
   *   tags: 'react,typescript',
   *   framework: 'react',
   *   language: 'typescript'
   * });
   * ```
   */
  async saveAsTemplate(
    workspaceId: string,
    request: SaveTemplateRequest
  ): Promise<WorkspaceTemplate> {
    const validatedRequest = SaveTemplateRequestSchema.parse(request)

    console.info(`💾 Saving workspace ${workspaceId} as template: ${validatedRequest.name}`)

    // Fetch the workspace to extract configuration
    const workspace = await prisma.workspace.findUnique({
      where: { workspace_id: workspaceId },
      include: {
        projects: {
          select: {
            name: true,
            language: true,
            framework: true,
            template: true,
            ai_prompt: true
          }
        }
      }
    })

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }

    // Build workspace configuration object
    const workspaceConfig: Prisma.InputJsonValue = {
      name: workspace.name,
      description: workspace.description,
      url: workspace.url,
      projects: workspace.projects,
      // Add any additional workspace configuration here
      metadata: {
        savedFrom: workspaceId,
        savedAt: new Date().toISOString()
      }
    }

    // Create the template
    const template = await prisma.workspaceTemplate.create({
      data: {
        name: validatedRequest.name,
        description: validatedRequest.description,
        user_id: validatedRequest.userId,
        workspace_config: workspaceConfig,
        is_public: validatedRequest.isPublic,
        tags: validatedRequest.tags,
        framework: validatedRequest.framework || workspace.projects[0]?.framework,
        language: validatedRequest.language || workspace.projects[0]?.language
      }
    })

    console.info(`✅ Template created successfully: ${template.id}`)
    return template as WorkspaceTemplate
  }

  /**
   * Lists workspace templates based on filter criteria.
   * Returns user's private templates and/or public templates.
   *
   * @param options - Filter options for listing templates
   * @param options.userId - Optional user ID to include user's private templates
   * @param options.isPublic - Optional flag to filter by public/private
   * @param options.framework - Optional framework to filter by
   * @param options.language - Optional language to filter by
   * @param options.limit - Maximum number of results (default: 50)
   * @param options.offset - Number of results to skip (default: 0)
   * @returns Promise resolving to array of templates
   *
   * @example
   * ```typescript
   * // Get user's private templates
   * const myTemplates = await service.listTemplates({ userId: 1, isPublic: false });
   *
   * // Get all public React templates
   * const publicReact = await service.listTemplates({ isPublic: true, framework: 'react' });
   *
   * // Get all templates (user's private + public)
   * const allTemplates = await service.listTemplates({ userId: 1 });
   * ```
   */
  async listTemplates(
    options: ListTemplatesOptions = {}
  ): Promise<WorkspaceTemplate[]> {
    const validatedOptions = ListTemplatesOptionsSchema.parse(options)

    console.info(`📋 Listing templates with filters:`, validatedOptions)

    // Build where clause based on options
    const where: Prisma.WorkspaceTemplateWhereInput = {}

    // If userId is provided, include user's templates OR public templates
    if (validatedOptions.userId !== undefined) {
      if (validatedOptions.isPublic !== undefined) {
        // Specific filter: either user's templates or public templates
        if (validatedOptions.isPublic) {
          where.is_public = true
        } else {
          where.user_id = validatedOptions.userId
          where.is_public = false
        }
      } else {
        // No isPublic filter: user's private templates + all public templates
        where.OR = [
          { user_id: validatedOptions.userId },
          { is_public: true }
        ]
      }
    } else if (validatedOptions.isPublic !== undefined) {
      // Only isPublic filter (no userId)
      where.is_public = validatedOptions.isPublic
    }

    // Add framework filter
    if (validatedOptions.framework) {
      where.framework = validatedOptions.framework
    }

    // Add language filter
    if (validatedOptions.language) {
      where.language = validatedOptions.language
    }

    const templates = await prisma.workspaceTemplate.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: validatedOptions.limit,
      skip: validatedOptions.offset
    })

    console.info(`✅ Found ${templates.length} templates`)
    return templates as WorkspaceTemplate[]
  }

  /**
   * Retrieves a specific workspace template by ID.
   * Returns the template if it exists and is accessible.
   *
   * @param templateId - The template ID to retrieve
   * @returns Promise resolving to the template
   * @throws Error if template not found
   *
   * @example
   * ```typescript
   * const template = await service.getTemplate(123);
   * console.log(template.name, template.workspace_config);
   * ```
   */
  async getTemplate(templateId: number): Promise<WorkspaceTemplate> {
    console.info(`🔍 Fetching template: ${templateId}`)

    const template = await prisma.workspaceTemplate.findUnique({
      where: { id: templateId }
    })

    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    console.info(`✅ Template found: ${template.name}`)
    return template as WorkspaceTemplate
  }

  /**
   * Deletes a workspace template.
   * Only the template owner should be able to delete their templates.
   * Authorization should be handled by the caller.
   *
   * @param templateId - The template ID to delete
   * @returns Promise resolving when deletion is complete
   * @throws Error if template not found
   *
   * @example
   * ```typescript
   * await service.deleteTemplate(123);
   * console.log('Template deleted successfully');
   * ```
   */
  async deleteTemplate(templateId: number): Promise<void> {
    console.info(`🗑️  Deleting template: ${templateId}`)

    const result = await prisma.workspaceTemplate.delete({
      where: { id: templateId }
    })

    console.info(`✅ Template deleted: ${result.name}`)
  }

  /**
   * Creates a new workspace from a template.
   * Clones the template configuration and creates a new workspace instance.
   * Note: This method returns the template configuration that should be used
   * to create a workspace via WorkspaceProvisioningService.
   *
   * @param templateId - The template ID to clone from
   * @param userId - The user ID creating the new workspace
   * @returns Promise resolving to the workspace configuration from template
   * @throws Error if template not found
   *
   * @example
   * ```typescript
   * const config = await service.cloneFromTemplate(123, 1);
   * // Use config with WorkspaceProvisioningService to create actual workspace
   * const workspace = await provisioningService.createWorkspace({
   *   projectId: 'new-project',
   *   projectName: config.name,
   *   framework: config.framework || 'react',
   *   userId: userId,
   *   files: config.files || {},
   *   dependencies: config.dependencies || []
   * });
   * ```
   */
  async cloneFromTemplate(
    templateId: number,
    userId: number
  ): Promise<Record<string, unknown>> {
    console.info(`🔄 Cloning workspace from template ${templateId} for user ${userId}`)

    const template = await this.getTemplate(templateId)

    // Extract workspace configuration
    const workspaceConfig = template.workspace_config as Record<string, unknown>

    console.info(`✅ Template configuration extracted for cloning`)

    return {
      ...workspaceConfig,
      userId,
      templateId,
      clonedAt: new Date().toISOString()
    }
  }
}
