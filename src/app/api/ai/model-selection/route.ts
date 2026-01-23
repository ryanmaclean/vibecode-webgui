import { NextRequest, NextResponse } from 'next/server'
import { intelligentModelSelection } from '@/lib/services/intelligent-model-selection'
import { validateRequestBody } from '@/lib/api/validation/middleware'
import { z } from '@/lib/zod-compat'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const apiRateLimit = createAPIRateLimit(60) // 60 requests per minute - read-heavy selection

// Define inline schema since schemas-phase4-batch2 doesn't exist
const modelSelectionRequestSchema = z.object({
  prompt: z.string().min(1).max(10_000, 'Prompt must not exceed 10KB (approximately 10,000 characters)'),
  metadata: z.object({
    taskType: z.enum(['code', 'chat', 'analysis', 'creative', 'reasoning']).optional(),
    contextLength: z.number().int().positive().optional(),
    hasImages: z.boolean().optional(),
    hasFiles: z.boolean().optional(),
    fileTypes: z.array(z.string()).max(10, 'Maximum 10 file types allowed').optional(),
    conversationHistory: z.number().int().min(0).max(100, 'Conversation history must not exceed 100').optional()
  }).optional(),
  preferences: z.object({
    prioritizeSpeed: z.boolean().optional(),
    prioritizeCost: z.boolean().optional(),
    prioritizeQuality: z.boolean().optional(),
    preferredProvider: z.enum(['openrouter', 'huggingface']).optional()
  }).optional()
})

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

    // Development authentication bypass
    const testUserId = request.headers.get('x-test-user-id')
    if (!testUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Validate request body
    const validation = await validateRequestBody(request, modelSelectionRequestSchema)
    if (!validation.success) {
      return validation.error as NextResponse
    }

    const { prompt, metadata, preferences } = validation.data

    const startTime = Date.now()

    // Analyze the prompt
    const analysis = intelligentModelSelection.analyzePrompt(prompt, metadata)

    // Select the best model
    const selection = intelligentModelSelection.selectBestModel(analysis, preferences)

    // Get detailed model information
    const selectedModelInfo = intelligentModelSelection.getModelById(selection.selectedModel)
    const fallbackModelInfo = intelligentModelSelection.getModelById(selection.fallbackModel)

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      selection: {
        selectedModel: selection.selectedModel,
        confidence: selection.confidence,
        reasoning: selection.reasoning,
        alternatives: selection.alternatives,
        fallbackModel: selection.fallbackModel
      },
      analysis: {
        type: analysis.type,
        complexity: analysis.complexity,
        promptLength: analysis.length,
        detectedLanguages: analysis.codeLanguages,
        requiresReasoning: analysis.requiresReasoning,
        requiresCreativity: analysis.requiresCreativity,
        requiresAccuracy: analysis.requiresAccuracy,
        hasMultimedia: analysis.hasImages || analysis.hasFiles,
        keywords: analysis.keywords.slice(0, 5) // Limit keywords
      },
      modelDetails: {
        selected: selectedModelInfo && {
          name: selectedModelInfo.name,
          provider: selectedModelInfo.provider,
          strengths: selectedModelInfo.strengths,
          contextLength: selectedModelInfo.contextLength,
          qualityTier: selectedModelInfo.qualityTier,
          speedTier: selectedModelInfo.speedTier,
          costTier: selectedModelInfo.costTier,
          capabilities: {
            supportsImages: selectedModelInfo.supportsImages,
            supportsCode: selectedModelInfo.supportsCode,
            supportsFunctionCalling: selectedModelInfo.supportsFunctionCalling,
            supportsStreaming: selectedModelInfo.supportsStreaming
          }
        },
        fallback: fallbackModelInfo && {
          name: fallbackModelInfo.name,
          provider: fallbackModelInfo.provider,
          reason: 'Fast, reliable fallback option'
        }
      },
      metadata: {
        responseTime,
        analysisTimestamp: new Date().toISOString(),
        apiVersion: '1.0',
        totalModelsEvaluated: intelligentModelSelection.getAllModels().length
      }
    })

  } catch (error: any) {
    // Server error logged
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Model selection failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

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

    // Development authentication bypass
    const testUserId = request.headers.get('x-test-user-id')
    if (!testUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider') as 'openrouter' | 'huggingface' | null
    const includeDetails = searchParams.get('details') === 'true'

    const models = provider 
      ? intelligentModelSelection.getModelsByProvider(provider)
      : intelligentModelSelection.getAllModels()

    const response = {
      success: true,
      models: models.map(model => includeDetails ? model : {
        id: model.id,
        name: model.name,
        provider: model.provider,
        strengths: model.strengths,
        qualityTier: model.qualityTier,
        speedTier: model.speedTier,
        costTier: model.costTier
      }),
      metadata: {
        totalModels: models.length,
        providers: [...new Set(models.map(m => m.provider))],
        strengthCategories: [
          'reasoning', 'coding', 'creative', 'conversational', 
          'mathematical', 'analysis', 'summarization', 'translation', 'instruction-following'
        ],
        costTiers: ['free', 'low', 'medium', 'high'],
        qualityTiers: ['basic', 'good', 'excellent'],
        speedTiers: ['slow', 'medium', 'fast']
      }
    }

    return NextResponse.json(response)

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch models'
    }, { status: 500 })
  }
}