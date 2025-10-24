/**
 * Template-based project generation API endpoint
 * Creates projects from pre-defined templates with customizations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from '@/lib/zod-compat'
import { generateFromTemplate, GenerateFromTemplateOptions } from '@/lib/templates/generator'
import { getTemplateById } from '@/lib/templates'
import { llmObservability } from '@/lib/datadog-llm'
import type { Span } from 'dd-trace'

const generateFromTemplateSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  projectName: z.string().min(1, 'Project name is required'),
  customizations: z.object({
    packageName: z.string().optional(),
    description: z.string().optional(),
    author: z.string().optional(),
    license: z.string().optional(),
    gitRepository: z.string().optional(),
  }).optional(),
  features: z.array(z.string()).optional(),
  envOverrides: z.record(z.string()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized: Please sign in to generate projects' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = generateFromTemplateSchema.parse(body)

    // Verify template exists
    const template = getTemplateById(validatedData.templateId)
    if (!template) {
      return NextResponse.json(
        { error: `Template "${validatedData.templateId}" not found` },
        { status: 404 }
      )
    }

    return llmObservability.createWorkflowSpan(
      'template-project-generation',
      async (span: Span | undefined) => {
        const startTime = Date.now()

        // Log the request
        span?.setTag('template.id', validatedData.templateId)
        span?.setTag('template.name', template.name)
        span?.setTag('template.category', template.category)
        span?.setTag('template.complexity', template.complexity)
        span?.setTag('user.id', session.user.id)
        
        llmObservability.annotate({
          input_data: {
            templateId: validatedData.templateId,
            projectName: validatedData.projectName,
            userId: session.user.id,
            templateName: template.name,
            templateCategory: template.category
          },
          tags: ['template-generation', 'project-scaffolding'],
        })

        try {
          // Generate project from template
          const options: GenerateFromTemplateOptions = {
            name: validatedData.projectName,
            templateId: validatedData.templateId,
            description: validatedData.customizations?.description,
            features: validatedData.features,
            customVariables: validatedData.envOverrides,
          }

          const generatedProject = await generateFromTemplate(options)

          // Create workspace ID
          const workspaceId = `template-${validatedData.templateId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

          // In a real implementation, this would:
          // 1. Create a new workspace/container
          // 2. Seed the generated files
          // 3. Install dependencies
          // 4. Start the development server

          const generationTime = Date.now() - startTime

          // Log successful generation
          llmObservability.annotate({
            output_data: {
              success: true,
              workspaceId,
              projectName: generatedProject.name,
              fileCount: generatedProject.files.length,
              generationTime,
              templateId: validatedData.templateId,
              hasDocker: template.dockerSupport,
              hasKubernetes: template.kubernetesSupport,
              hasTesting: template.testingSetup,
              hasCICD: template.cicdTemplate
            },
            tags: ['template-generation', 'project-scaffolding', 'success'],
            metadata: {
              endpoint: '/api/projects/template',
              method: 'POST',
              user: session.user.id,
              generationTime: `${generationTime}ms`,
              templateComplexity: template.complexity
            }
          })

          return NextResponse.json({
            success: true,
            workspaceId,
            workspaceUrl: `/workspace/${workspaceId}`,
            projectStructure: {
              name: generatedProject.name,
              description: generatedProject.description,
              fileCount: generatedProject.files.length,
              templateId: validatedData.templateId,
              templateName: template.name,
              language: template.language,
              frameworks: template.frameworks,
              features: validatedData.features || template.features,
              setupTime: template.estimatedSetupTime
            },
            generationTime,
            setupInstructions: generatedProject.setupInstructions,
            envVars: generatedProject.envVars.filter(env => env.value),
            nextSteps: [
              `Navigate to /workspace/${workspaceId}`,
              'Review the generated project structure',
              'Follow the setup instructions in README.md',
              'Start development with the provided scripts'
            ]
          })

        } catch (error) {
          // Server error logged
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          
          span?.setTag('error', true)
          span?.setTag('error.message', errorMessage)
          if (error instanceof Error && error.stack) {
            span?.setTag('error.stack', error.stack)
          }

          // Log the error
          llmObservability.annotate({
            input_data: { error: true },
            output_data: { error: errorMessage },
            metadata: {
              endpoint: '/api/projects/template',
              method: 'POST',
              error_type: error?.constructor?.name || 'UnknownError',
              templateId: validatedData.templateId
            },
            tags: ['template-generation', 'project-scaffolding', 'error']
          })

          return NextResponse.json(
            { 
              error: 'Failed to generate project from template',
              message: errorMessage,
              templateId: validatedData.templateId,
              recoveryOptions: [
                { label: 'Try Again', action: 'retry' },
                { label: 'Choose Different Template', action: 'change-template' },
                { label: 'Use AI Generation Instead', action: 'use-ai' },
                { label: 'Contact Support', action: 'support' }
              ]
            },
            { status: 500 }
          )
        }
      }
    )

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    // Server error logged
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint for retrieving available templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const complexity = searchParams.get('complexity')
    const language = searchParams.get('language')
    const framework = searchParams.get('framework')
    const search = searchParams.get('search')

    const { 
      PROJECT_TEMPLATES, 
      getTemplatesByCategory, 
      getTemplatesByComplexity,
      searchTemplates 
    } = await import('@/lib/templates')

    let filteredTemplates = PROJECT_TEMPLATES

    // Apply filters
    if (category && category !== 'all') {
      filteredTemplates = getTemplatesByCategory(category as any)
    }

    if (complexity && complexity !== 'all') {
      filteredTemplates = filteredTemplates.filter(t => t.complexity === complexity)
    }

    if (language) {
      filteredTemplates = filteredTemplates.filter(t => 
        t.language.some(lang => lang.toLowerCase().includes(language.toLowerCase()))
      )
    }

    if (framework) {
      filteredTemplates = filteredTemplates.filter(t => 
        t.frameworks.some(fw => fw.toLowerCase().includes(framework.toLowerCase()))
      )
    }

    if (search) {
      filteredTemplates = searchTemplates(search)
    }

    // Return templates with minimal data for listing
    const templateList = filteredTemplates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      complexity: template.complexity,
      language: template.language,
      frameworks: template.frameworks,
      features: template.features,
      estimatedSetupTime: template.estimatedSetupTime,
      tags: template.tags,
      dockerSupport: template.dockerSupport,
      kubernetesSupport: template.kubernetesSupport,
      testingSetup: template.testingSetup,
      cicdTemplate: template.cicdTemplate,
      monitoringSetup: template.monitoringSetup
    }))

    return NextResponse.json({
      templates: templateList,
      totalCount: templateList.length,
      filters: {
        category,
        complexity,
        language,
        framework,
        search
      }
    })

  } catch (error) {
    // Server error logged
    return NextResponse.json(
      { error: 'Failed to retrieve templates' },
      { status: 500 }
    )
  }
}