/**
 * RUM Monitoring API Endpoint
 * Provides RUM configuration, health status, and session management
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'config'

    switch (action) {
      case 'config':
        // Return RUM configuration for client-side initialization
        const rumConfig = {
          enabled: !!(
            process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID && 
            process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN
          ),
          applicationId: process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID || '',
          site: process.env.NEXT_PUBLIC_DATADOG_SITE || 'datadoghq.com',
          service: 'vibecode-webgui',
          env: process.env.NODE_ENV || 'development',
          version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
          features: {
            sessionReplay: true,
            userInteractions: true,
            resources: true,
            longTasks: true,
            webVitals: true,
            errorTracking: true
          },
          sampling: {
            sessionSampleRate: 100,
            sessionReplaySampleRate: process.env.NODE_ENV === 'production' ? 20 : 100
          }
        }

        return NextResponse.json({
          rum: rumConfig,
          timestamp: new Date().toISOString(),
          status: 'success'
        })

      case 'health':
        // RUM health check
        const isConfigured = !!(
          process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID && 
          process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN
        )

        return NextResponse.json({
          healthy: isConfigured,
          status: isConfigured ? 'configured' : 'missing-config',
          configuration: {
            hasApplicationId: !!process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID,
            hasClientToken: !!process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN,
            site: process.env.NEXT_PUBLIC_DATADOG_SITE || 'datadoghq.com'
          },
          features: {
            sessionReplay: isConfigured,
            userTracking: isConfigured,
            performanceMonitoring: isConfigured,
            errorTracking: isConfigured
          },
          timestamp: new Date().toISOString()
        })

      case 'features':
        // Return available RUM features and their status
        return NextResponse.json({
          features: {
            'session-replay': {
              enabled: true,
              description: 'Record user sessions for debugging and UX analysis'
            },
            'user-interactions': {
              enabled: true,
              description: 'Track clicks, scrolls, and other user interactions'
            },
            'web-vitals': {
              enabled: true,
              description: 'Monitor Core Web Vitals and performance metrics'
            },
            'error-tracking': {
              enabled: true,
              description: 'Capture and analyze client-side errors'
            },
            'ai-tracking': {
              enabled: true,
              description: 'Track AI interactions and performance'
            },
            'workspace-tracking': {
              enabled: true,
              description: 'Monitor workspace usage and productivity'
            },
            'code-editor-tracking': {
              enabled: true,
              description: 'Track code editor usage and efficiency'
            },
            'terminal-tracking': {
              enabled: true,
              description: 'Monitor terminal usage with privacy safeguards'
            }
          },
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({
          error: 'Invalid action',
          available_actions: ['config', 'health', 'features']
        }, { status: 400 })
    }

  } catch (error) {
    console.error('RUM API error:', error)
    
    return NextResponse.json({
      error: 'Failed to retrieve RUM data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'track_conversion':
        // Track business conversions
        console.log('🎯 Conversion tracked:', {
          type: data.type,
          value: data.value,
          userId: data.userId,
          timestamp: new Date().toISOString()
        })

        return NextResponse.json({
          success: true,
          message: 'Conversion tracked successfully',
          timestamp: new Date().toISOString()
        })

      case 'track_feature_usage':
        // Track feature usage for product analytics
        console.log('📊 Feature usage tracked:', {
          feature: data.feature,
          action: data.action,
          userId: data.userId,
          metadata: data.metadata,
          timestamp: new Date().toISOString()
        })

        return NextResponse.json({
          success: true,
          message: 'Feature usage tracked',
          timestamp: new Date().toISOString()
        })

      case 'track_user_journey':
        // Track user journey steps
        console.log('🗺️ User journey tracked:', {
          flow: data.flow,
          step: data.step,
          userId: data.userId,
          metadata: data.metadata,
          timestamp: new Date().toISOString()
        })

        return NextResponse.json({
          success: true,
          message: 'User journey step tracked',
          timestamp: new Date().toISOString()
        })

      case 'track_performance':
        // Track custom performance metrics
        console.log('⚡ Performance metric tracked:', {
          metric: data.metric,
          value: data.value,
          context: data.context,
          timestamp: new Date().toISOString()
        })

        return NextResponse.json({
          success: true,
          message: 'Performance metric tracked',
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({
          error: 'Invalid action',
          available_actions: ['track_conversion', 'track_feature_usage', 'track_user_journey', 'track_performance']
        }, { status: 400 })
    }

  } catch (error) {
    console.error('RUM tracking error:', error)
    
    return NextResponse.json({
      error: 'Failed to process RUM tracking',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}