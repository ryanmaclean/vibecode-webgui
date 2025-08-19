/**
 * Monitoring Metrics API Endpoint
 * Provides detailed metrics and performance data
 */

import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const metricType = searchParams.get('type') || 'all'
    const timeRange = searchParams.get('range') || '1h'
    const limit = parseInt(searchParams.get('limit') || '100')

    // Mock metrics data for now - replace with actual implementation
    const mockMetrics = {
      system: {
        cpu_usage: Math.random() * 100,
        memory_usage: Math.random() * 100,
        disk_usage: Math.random() * 100,
        network_io: Math.random() * 1000
      },
      application: {
        request_count: Math.floor(Math.random() * 1000),
        error_rate: Math.random() * 0.1,
        response_time: Math.random() * 1000,
        active_connections: Math.floor(Math.random() * 100)
      },
      business: {
        user_sessions: Math.floor(Math.random() * 500),
        api_calls: Math.floor(Math.random() * 2000),
        database_queries: Math.floor(Math.random() * 5000),
        cache_hit_rate: Math.random() * 0.9
      }
    }

    let filteredMetrics: Record<string, unknown> = {}

    if (metricType === 'all') {
      filteredMetrics = mockMetrics
    } else if (metricType === 'system') {
      filteredMetrics = { system: mockMetrics.system }
    } else if (metricType === 'application') {
      filteredMetrics = { application: mockMetrics.application }
    } else if (metricType === 'business') {
      filteredMetrics = { business: mockMetrics.business }
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
          source: 'mock_data'
        }
      }
    })

  } catch (error) {
    // Server error logged
    
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
    // Server error logged
    
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