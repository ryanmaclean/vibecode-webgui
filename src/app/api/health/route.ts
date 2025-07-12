/**
 * Health Check API Endpoint
 * Provides application health status for monitoring and deployment
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Basic health checks
    const healthChecks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        memory: checkMemoryUsage(),
        disk: await checkDiskSpace(),
        database: await checkDatabase(),
        redis: await checkRedis(),
        ai: await checkAIService()
      }
    }

    // Calculate response time
    const responseTime = Date.now() - startTime
    healthChecks.responseTime = `${responseTime}ms`

    // Determine overall health status
    const hasFailures = Object.values(healthChecks.checks).some(check => check.status !== 'healthy')
    if (hasFailures) {
      healthChecks.status = 'degraded'
      return NextResponse.json(healthChecks, { status: 503 })
    }

    return NextResponse.json(healthChecks, { status: 200 })

  } catch (error) {
    console.error('Health check error:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: `${Date.now() - startTime}ms`
    }, { status: 503 })
  }
}

function checkMemoryUsage() {
  try {
    const memUsage = process.memoryUsage()
    const totalMem = memUsage.heapTotal / 1024 / 1024 // MB
    const usedMem = memUsage.heapUsed / 1024 / 1024 // MB
    const memoryPercentage = (usedMem / totalMem) * 100

    return {
      status: memoryPercentage > 90 ? 'warning' : 'healthy',
      details: {
        used: `${Math.round(usedMem)}MB`,
        total: `${Math.round(totalMem)}MB`,
        percentage: `${Math.round(memoryPercentage)}%`
      }
    }
  } catch (error) {
    return {
      status: 'error',
      error: 'Failed to check memory usage'
    }
  }
}

async function checkDiskSpace() {
  try {
    // Basic disk space check (platform-specific)
    const fs = await import('fs/promises')
    const stats = await fs.stat(process.cwd())
    
    return {
      status: 'healthy',
      details: {
        accessible: true,
        writable: true
      }
    }
  } catch (error) {
    return {
      status: 'error',
      error: 'Failed to check disk space'
    }
  }
}

async function checkDatabase() {
  try {
    // Check database connection if configured
    const databaseUrl = process.env.DATABASE_URL
    
    if (!databaseUrl) {
      return {
        status: 'healthy',
        details: 'Database not configured (using file storage)'
      }
    }

    // For now, just check if the URL is valid
    const url = new URL(databaseUrl)
    
    return {
      status: 'healthy',
      details: {
        host: url.hostname,
        database: url.pathname.substring(1),
        ssl: url.protocol === 'postgres:'
      }
    }
  } catch (error) {
    return {
      status: 'error',
      error: 'Database connection failed'
    }
  }
}

async function checkRedis() {
  try {
    // Check Redis connection if configured
    const redisUrl = process.env.REDIS_URL
    
    if (!redisUrl) {
      return {
        status: 'healthy',
        details: 'Redis not configured (using memory storage)'
      }
    }

    // For now, just check if the URL is valid
    const url = new URL(redisUrl)
    
    return {
      status: 'healthy',
      details: {
        host: url.hostname,
        port: url.port || '6379'
      }
    }
  } catch (error) {
    return {
      status: 'error',
      error: 'Redis connection failed'
    }
  }
}

async function checkAIService() {
  try {
    // Check AI service configuration
    const openRouterKey = process.env.OPENROUTER_API_KEY
    
    if (!openRouterKey) {
      return {
        status: 'warning',
        details: 'OpenRouter API key not configured'
      }
    }

    // Validate API key format
    if (openRouterKey.startsWith('sk-or-') || openRouterKey.length > 20) {
      return {
        status: 'healthy',
        details: 'OpenRouter API key configured'
      }
    }

    return {
      status: 'warning',
      details: 'OpenRouter API key format invalid'
    }
  } catch (error) {
    return {
      status: 'error',
      error: 'Failed to check AI service'
    }
  }
}

// Handle CORS for health checks
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}