// Ollama Models API - Management interface for local AI models
// Provides model listing, installation, and health checking

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ollamaClient, RECOMMENDED_MODELS } from '@/lib/ollama-client'
import { createAPIRateLimit } from '@/lib/rate-limiting'
// import { logger } from '../../../../lib/logger';

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'health':
        return handleHealthCheck()
      case 'recommended':
        return handleGetRecommended()
      default:
        return handleListModels()
    }
  } catch (error) {
    console.error('Ollama models API error:', { error: error })
    return NextResponse.json(
      {
        error: 'Failed to process Ollama request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, model } = body

    switch (action) {
      case 'pull':
        return handlePullModel(model)
      case 'delete':
        return handleDeleteModel(model)
      case 'info':
        return handleGetModelInfo(model)
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Ollama models POST error:', { error: error })
    return NextResponse.json(
      {
        error: 'Failed to process Ollama request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleHealthCheck() {
  try {
    const isAvailable = await ollamaClient.isAvailable()
    
    if (!isAvailable) {
      return NextResponse.json({
        status: 'unavailable',
        message: 'Ollama is not running or not accessible',
        recommendations: [
          'Install Ollama from https://ollama.ai',
          'Start Ollama service: ollama serve',
          'Check if port 11434 is accessible',
          'Verify Docker container is running if using Docker'
        ]
      })
    }

    // Get basic system info
    const models = await ollamaClient.listModels()
    
    return NextResponse.json({
      status: 'available',
      message: 'Ollama is running and accessible',
      info: {
        modelsInstalled: models.length,
        totalSize: models.reduce((sum, model) => sum + model.size, 0),
        models: models.map(model => ({
          name: model.name,
          size: ollamaClient.formatModelSize(model.size),
          family: model.details.family,
          modified: model.modified_at
        }))
      }
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Failed to check Ollama health',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleListModels() {
  try {
    const isAvailable = await ollamaClient.isAvailable()
    
    if (!isAvailable) {
      return NextResponse.json({
        available: false,
        models: [],
        message: 'Ollama is not running'
      })
    }

    const models = await ollamaClient.listModels()
    
    const formattedModels = models.map(model => ({
      name: model.name,
      model: model.model,
      size: model.size,
      sizeFormatted: ollamaClient.formatModelSize(model.size),
      family: model.details.family,
      format: model.details.format,
      parameterSize: model.details.parameter_size,
      quantization: model.details.quantization_level,
      modified: model.modified_at,
      estimatedSpeed: ollamaClient.estimateInferenceTime(model.size, 100) // 100 token prompt
    }))

    return NextResponse.json({
      available: true,
      models: formattedModels,
      totalModels: models.length,
      totalSize: models.reduce((sum, model) => sum + model.size, 0),
      totalSizeFormatted: ollamaClient.formatModelSize(
        models.reduce((sum, model) => sum + model.size, 0)
      )
    })
  } catch (error) {
    return NextResponse.json({
      available: false,
      models: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleGetRecommended() {
  return NextResponse.json({
    recommended: RECOMMENDED_MODELS,
    descriptions: {
      coding: 'Specialized models for code generation, completion, and analysis',
      general: 'Balanced models for general conversation and tasks',
      lightweight: 'Fast, small models for quick responses',
      creative: 'Models optimized for creative writing and storytelling'
    },
    installation: {
      steps: [
        'Select a model from the recommended list',
        'Click "Install" to download the model',
        'Wait for download to complete (may take several minutes)',
        'Model will be available for use immediately after installation'
      ],
      requirements: {
        disk: 'Models range from 360MB to 40GB+ depending on size',
        memory: 'At least 4GB RAM recommended for small models',
        network: 'Internet connection required for initial download'
      }
    }
  })
}

async function handlePullModel(model: string) {
  if (!model) {
    return NextResponse.json(
      { error: 'Model name is required' },
      { status: 400 }
    )
  }

  try {
    const isAvailable = await ollamaClient.isAvailable()
    
    if (!isAvailable) {
      return NextResponse.json(
        { error: 'Ollama is not running' },
        { status: 503 }
      )
    }

    // This is a simplified version - in production, you'd want to stream the progress
    const success = await ollamaClient.pullModel(model)
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: `Model ${model} installed successfully`,
        model
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to install model' },
        { status: 500 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to install model',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleDeleteModel(model: string) {
  if (!model) {
    return NextResponse.json(
      { error: 'Model name is required' },
      { status: 400 }
    )
  }

  try {
    const success = await ollamaClient.deleteModel(model)
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: `Model ${model} deleted successfully`,
        model
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to delete model' },
        { status: 500 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to delete model',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleGetModelInfo(model: string) {
  if (!model) {
    return NextResponse.json(
      { error: 'Model name is required' },
      { status: 400 }
    )
  }

  try {
    const info = await ollamaClient.getModelInfo(model)
    return NextResponse.json({
      success: true,
      model,
      info
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to get model info',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handle CORS
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
  }
  return ['https://vibecode.dev', 'http://localhost:3000', 'http://localhost:8080']
}

function getValidatedCorsOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null
  const allowedOrigins = getAllowedOrigins()
  if (allowedOrigins.includes(requestOrigin)) return requestOrigin
  return null
}

export async function OPTIONS(request: NextRequest) {
  const requestOrigin = request.headers.get('origin')
  const validatedOrigin = getValidatedCorsOrigin(requestOrigin)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '3600',
  }
  if (validatedOrigin) {
    headers['Access-Control-Allow-Origin'] = validatedOrigin
    headers['Vary'] = 'Origin'
  }
  return new NextResponse(null, { status: 200, headers })
}