// Offline Setup API - AI provider offline readiness and configuration
// Provides offline mode status checking and setup recommendations

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ollamaClient } from '@/lib/ollama-client'
import { createAPIRateLimit } from '@/lib/rate-limiting'
import { getOfflineConfig, updateOfflineConfig } from '@/lib/config/offline-config'

const apiRateLimit = createAPIRateLimit(30) // 30 requests per minute

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

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
    const { action, config } = body

    switch (action) {
      case 'check':
        return handleCheckReadiness()
      case 'configure':
        return handleConfigure(config)
      case 'status':
        return handleGetStatus()
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Offline setup API error:', { error: error })
    return NextResponse.json(
      {
        error: 'Failed to process offline setup request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleCheckReadiness() {
  try {
    const readinessStatus = await ollamaClient.checkOfflineReadiness()
    const offlineConfig = await getOfflineConfig()

    return NextResponse.json({
      status: 'success',
      offline: {
        ready: readinessStatus.ready,
        ollamaAvailable: readinessStatus.ollamaAvailable,
        installedModels: readinessStatus.installedModels,
        recommendedModels: readinessStatus.recommendedModels,
        missingModels: readinessStatus.missingModels,
        diskUsage: readinessStatus.diskUsageSummary,
        checks: readinessStatus.checks,
        recommendations: readinessStatus.recommendations
      },
      config: {
        autoFallbackEnabled: offlineConfig.autoFallbackEnabled,
        preferredLocalModel: offlineConfig.preferredLocalModel,
        fallbackLocalModels: offlineConfig.fallbackLocalModels,
        showOfflineNotifications: offlineConfig.showOfflineNotifications
      }
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Failed to check offline readiness',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleConfigure(config: any) {
  if (!config) {
    return NextResponse.json(
      { error: 'Configuration data is required' },
      { status: 400 }
    )
  }

  try {
    const updatedConfig = await updateOfflineConfig(config)

    return NextResponse.json({
      status: 'success',
      message: 'Offline configuration updated successfully',
      config: {
        autoFallbackEnabled: updatedConfig.autoFallbackEnabled,
        preferredLocalModel: updatedConfig.preferredLocalModel,
        fallbackLocalModels: updatedConfig.fallbackLocalModels,
        showOfflineNotifications: updatedConfig.showOfflineNotifications,
        lastUpdated: updatedConfig.lastUpdated
      }
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Failed to update offline configuration',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleGetStatus() {
  try {
    const isAvailable = await ollamaClient.isAvailable()
    const isReady = await ollamaClient.isReadyForOffline()
    const bestModel = await ollamaClient.getBestOfflineModel()
    const offlineConfig = await getOfflineConfig()

    return NextResponse.json({
      status: 'success',
      offline: {
        available: isAvailable,
        ready: isReady,
        bestModel,
        autoFallbackEnabled: offlineConfig.autoFallbackEnabled,
        preferredModel: offlineConfig.preferredLocalModel
      },
      message: isReady
        ? 'Offline mode is ready'
        : 'Offline mode is not fully configured'
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Failed to get offline status',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '3600',
  }
  if (validatedOrigin) {
    headers['Access-Control-Allow-Origin'] = validatedOrigin
    headers['Vary'] = 'Origin'
  }
  return new NextResponse(null, { status: 200, headers })
}
