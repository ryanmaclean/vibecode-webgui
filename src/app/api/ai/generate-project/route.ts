/**
 * AI Project Generation API Route
 * Core API endpoint for Lovable.ai clone functionality
 */

import { NextRequest, NextResponse } from 'next/server'
import { AIProjectGenerator } from '@/lib/services/ai-project-generator'
import { z } from 'zod'

const ProjectGenerationRequestSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  framework: z.string().optional(),
  features: z.array(z.string()).optional(),
  complexity: z.enum(['simple', 'moderate', 'complex']).default('moderate'),
  userId: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 AI Project Generation API called')

    // Parse and validate request
    const body = await request.json()
    const validatedRequest = ProjectGenerationRequestSchema.parse(body)

    console.log(`📝 Generating project for prompt: "${validatedRequest.prompt}"`)

    // Check for required API key
    const openaiApiKey = process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY
    if (!openaiApiKey) {
      console.error('❌ No OpenAI API key configured')
      return NextResponse.json(
        { error: 'AI service not configured. Please set OPENAI_API_KEY.' },
        { status: 500 }
      )
    }

    // Initialize AI project generator
    const generator = new AIProjectGenerator(openaiApiKey)

    // Generate project
    const startTime = Date.now()
    const generatedProject = await generator.generateProject(validatedRequest)
    const generationTime = Date.now() - startTime

    console.log(`✅ Project generated successfully in ${generationTime}ms`)
    console.log(`📊 Generated project: ${generatedProject.name} (${generatedProject.framework})`)
    console.log(`📁 Files generated: ${Object.keys(generatedProject.structure).length}`)

    // Return generated project
    return NextResponse.json({
      success: true,
      project: generatedProject,
      metadata: {
        generationTime,
        filesGenerated: Object.keys(generatedProject.structure).length,
        framework: generatedProject.framework,
        features: generatedProject.features
      }
    })

  } catch (error) {
    console.error('❌ Project generation failed:', error)

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      )
    }

    // Handle AI service errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'AI service authentication failed' },
          { status: 401 }
        )
      }

      if (error.message.includes('rate limit') || error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'AI service rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      }

      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Project generation timed out. Please try a simpler prompt.' },
          { status: 408 }
        )
      }
    }

    // Generic error response
    return NextResponse.json(
      { 
        error: 'Project generation failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({
        available: false,
        reason: 'No AI API key configured'
      })
    }

    // Initialize generator to get available templates
    const generator = new AIProjectGenerator(openaiApiKey)
    const templates = generator.getAvailableTemplates()

    return NextResponse.json({
      available: true,
      service: 'AI Project Generator',
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        framework: t.framework,
        features: t.features
      })),
      supportedFrameworks: ['react', 'nextjs', 'vue', 'angular', 'svelte', 'node', 'python', 'go'],
      complexityLevels: ['simple', 'moderate', 'complex']
    })
  } catch (error) {
    console.error('❌ Failed to get project generation info:', error)
    return NextResponse.json({
      available: false,
      reason: 'Service initialization failed'
    })
  }
}