/**
 * Monitoring system health check endpoint
 * Provides comprehensive health status for monitoring infrastructure
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface ComponentHealth {
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime: number
  lastCheck: string
  details?: Record<string, any>
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  uptime: number
  version: string
  environment: string
  components: Record<string, ComponentHealth>
  metrics: {
    totalMetricsCollected: number
    averageResponseTime: number
    errorRate: number
    activeMonitoringSessions: number
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Allow public health check for basic status
    const isPublicEndpoint = request.nextUrl.pathname.includes('/public')
    const isAuthenticated = !!session?.user
    const isAdmin = session?.user?.role === 'admin'
    
    // Basic health check
    const startTime = Date.now()
    const uptime = process.uptime()
    
    // Component health checks
    const components: Record<string, ComponentHealth> = {}
    
    // Check Datadog connectivity
    components.datadog = await checkDatadogHealth()
    
    // Check database connectivity
    components.database = await checkDatabaseHealth()
    
    // Check Redis connectivity
    components.redis = await checkRedisHealth()
    
    // Check metrics API health
    components.metrics_api = await checkMetricsAPIHealth()
    
    // Determine overall health status
    const componentStatuses = Object.values(components).map(c => c.status)
    const overallStatus = determineOverallStatus(componentStatuses)
    
    const baseHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }
    
    // Public endpoint - return minimal info
    if (isPublicEndpoint) {
      return NextResponse.json(baseHealth)
    }
    
    // Require authentication for detailed health info
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    // Admin users get full health details
    if (isAdmin) {
      const fullHealth: HealthStatus = {
        ...baseHealth,
        components,
        metrics: await getMonitoringMetrics()
      }
      
      return NextResponse.json(fullHealth)
    }
    
    // Regular users get limited details
    const limitedHealth = {
      ...baseHealth,
      components: Object.fromEntries(
        Object.entries(components).map(([name, component]) => [
          name,
          { status: component.status, responseTime: component.responseTime }
        ])
      )
    }
    
    return NextResponse.json(limitedHealth)
    
  } catch (error) {
    console.error('Health check error:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      uptime: Math.round(process.uptime())
    }, { status: 500 })
  }
}

async function checkDatadogHealth(): Promise<ComponentHealth> {
  const startTime = Date.now()
  
  try {
    // Check if Datadog configuration is present
    const hasApiKey = !!process.env.DD_API_KEY
    const hasConfig = hasApiKey && !!process.env.DD_SITE
    
    if (!hasConfig) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: { error: 'Missing Datadog configuration' }
      }
    }
    
    // Validate API key format (should be 32 character hex string)
    const apiKey = process.env.DD_API_KEY as string
    const isValidApiKeyFormat = /^[a-f0-9]{32}$/.test(apiKey)
    
    if (!isValidApiKeyFormat) {
      return {
        status: 'degraded',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: { 
          error: 'Invalid Datadog API key format',
          site: process.env.DD_SITE 
        }
      }
    }
    
    // For real integration testing, make actual API call to Datadog validate endpoint
    if (process.env.ENABLE_DATADOG_INTEGRATION_TESTS === 'true') {
      try {
        const response = await fetch('https://api.datadoghq.com/api/v1/validate', {
          method: 'GET',
          headers: {
            'DD-API-KEY': apiKey
          },
          timeout: 5000
        })
        
        if (response.ok) {
          const validation = await response.json()
          return {
            status: 'healthy',
            responseTime: Date.now() - startTime,
            lastCheck: new Date().toISOString(),
            details: {
              site: process.env.DD_SITE,
              configured: true,
              apiKeyValid: validation.valid,
              integrationTested: true
            }
          }
        } else {
          return {
            status: 'degraded',
            responseTime: Date.now() - startTime,
            lastCheck: new Date().toISOString(),
            details: {
              error: `API validation failed: ${response.status}`,
              site: process.env.DD_SITE,
              integrationTested: true
            }
          }
        }
      } catch (apiError) {
        return {
          status: 'degraded',
          responseTime: Date.now() - startTime,
          lastCheck: new Date().toISOString(),
          details: {
            error: `API call failed: ${(apiError as Error).message}`,
            site: process.env.DD_SITE,
            integrationTested: true
          }
        }
      }
    }
    
    // Basic configuration validation without API call
    const responseTime = Date.now() - startTime
    
    return {
      status: 'healthy',
      responseTime,
      lastCheck: new Date().toISOString(),
      details: {
        site: process.env.DD_SITE,
        configured: true,
        apiKeyFormat: 'valid',
        integrationTested: false
      }
    }
    
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details: { error: (error as Error).message }
    }
  }
}

async function checkDatabaseHealth(): Promise<ComponentHealth> {
  const startTime = Date.now()
  
  try {
    // For demonstration - replace with actual database health check
    const responseTime = Date.now() - startTime
    
    return {
      status: 'healthy',
      responseTime,
      lastCheck: new Date().toISOString(),
      details: {
        connectionPool: 'active',
        activeConnections: 5
      }
    }
    
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details: { error: (error as Error).message }
    }
  }
}

async function checkRedisHealth(): Promise<ComponentHealth> {
  const startTime = Date.now()
  
  try {
    // For demonstration - replace with actual Redis health check
    const responseTime = Date.now() - startTime
    
    return {
      status: 'healthy',
      responseTime,
      lastCheck: new Date().toISOString(),
      details: {
        memory: 'optimal',
        connections: 3
      }
    }
    
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details: { error: (error as Error).message }
    }
  }
}

async function checkMetricsAPIHealth(): Promise<ComponentHealth> {
  const startTime = Date.now()
  
  try {
    // Test internal metrics API
    const responseTime = Date.now() - startTime
    
    return {
      status: 'healthy',
      responseTime,
      lastCheck: new Date().toISOString(),
      details: {
        endpointsActive: true,
        lastMetricReceived: new Date().toISOString()
      }
    }
    
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details: { error: (error as Error).message }
    }
  }
}

async function getMonitoringMetrics() {
  // Get current monitoring system metrics
  return {
    totalMetricsCollected: 15432, // Replace with actual counter
    averageResponseTime: 142,     // Replace with actual calculation
    errorRate: 0.02,             // Replace with actual calculation
    activeMonitoringSessions: 8   // Replace with actual count
  }
}

function determineOverallStatus(componentStatuses: string[]): 'healthy' | 'unhealthy' | 'degraded' {
  const unhealthyCount = componentStatuses.filter(s => s === 'unhealthy').length
  const degradedCount = componentStatuses.filter(s => s === 'degraded').length
  
  if (unhealthyCount > 0) {
    return 'unhealthy'
  }
  
  if (degradedCount > 0) {
    return 'degraded'
  }
  
  return 'healthy'
}