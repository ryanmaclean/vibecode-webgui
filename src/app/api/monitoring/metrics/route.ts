/**
 * Monitoring Metrics API Endpoint
 * Provides detailed metrics and performance data
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '../../../../lib/monitoring/auth'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Check authentication first
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }
  try {
    const { searchParams } = new URL(request.url)
    const metricType = searchParams.get('type') || 'all'
    const timeRange = searchParams.get('range') || '1h'
    const limit = parseInt(searchParams.get('limit') || '100')

    // Get real production metrics using service factory
    const { MonitoringServiceFactory } = await import('../../../../lib/monitoring/service-factory')
    const serviceFactory = new MonitoringServiceFactory()
    
    try {
      const productionMetrics = await serviceFactory.getAggregatedMetrics()
      
      const realMetrics = {
        system: {
          memory_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          memory_total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          memory_usage_percent: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
          uptime_seconds: Math.floor(process.uptime()),
          node_version: process.version,
          platform: process.platform
        },
        application: {
          total_services: productionMetrics.totalServices,
          healthy_services: productionMetrics.healthyServices,
          warning_services: productionMetrics.warningServices,
          error_services: productionMetrics.errorServices,
          overall_health: productionMetrics.overallHealth
        },
        services: productionMetrics.services.map(service => ({
          provider: service.provider,
          service_name: service.service,
          is_active: service.isActive,
          health_status: service.healthStatus,
          last_checked: service.lastChecked,
          avg_response_time: service.metrics?.avgResponseTime,
          configuration_summary: Object.keys(service.configuration).length + ' settings'
        }))
      }
      
      await serviceFactory.disconnect()
      
      var metricsData: any = realMetrics
    } catch (serviceError) {
      console.error('Failed to get production metrics, falling back to basic system metrics:', serviceError)
      
      // Fallback to basic system metrics if service factory fails
      const fallbackMetrics = {
        system: {
          memory_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          memory_total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          memory_usage_percent: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
          uptime_seconds: Math.floor(process.uptime()),
          node_version: process.version,
          platform: process.platform
        },
        application: {
          status: 'degraded',
          error: 'Unable to fetch production service metrics'
        },
        services: []
      }
      
      await serviceFactory.disconnect()
      metricsData = fallbackMetrics
    }

    let filteredMetrics: Record<string, unknown> = {}

    if (metricType === 'all') {
      filteredMetrics = metricsData
    } else if (metricType === 'system') {
      filteredMetrics = { system: metricsData.system }
    } else if (metricType === 'application') {
      filteredMetrics = { application: metricsData.application }
    } else if (metricType === 'business') {
      filteredMetrics = { business: (metricsData as any).business }
    }

    return NextResponse.json({
      success: true,
      data: {
        metrics: filteredMetrics,
        metadata: {
          type: metricType,
          time_range: timeRange,
          limit,
          timestamp: new Date().toISOString(),
          source: 'production_services'
        }
      }
    })

  } catch (error) {
    console.error('Error fetching metrics:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Check authentication first
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }
  try {
    const body = await request.json()
    const { metric_name, value, tags, timestamp } = body

    // Validate required fields
    if (!metric_name || value === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: metric_name and value',
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      )
    }

    // Mock metric submission - replace with actual implementation
    const submittedMetric = {
      name: metric_name,
      value,
      tags: tags || {},
      timestamp: timestamp || new Date().toISOString(),
      status: 'submitted'
    }

    return NextResponse.json({
      success: true,
      data: {
        metric: submittedMetric,
        message: 'Metric submitted successfully',
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error submitting metric:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to submit metric',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}