/**
 * @description Real User Monitoring (RUM) API - Provides RUM configuration, health status, and client-side analytics tracking. Supports session replay, user interactions, web vitals, and feature usage tracking for comprehensive user experience monitoring.
 * @route GET /api/monitoring/rum
 * @route POST /api/monitoring/rum
 * @access Public (client-side RUM collection)
 *
 * @param {NextRequest} request - Next.js request with query parameters:
 *   - action: 'config' | 'health' | 'features' - Action to perform (GET only)
 *
 * @returns {Response} GET with action=config returns RUM configuration:
 *   - rum: { enabled, applicationId, site, service, env, version, features, sampling } - RUM config
 *   - timestamp: string - Current timestamp
 *   - status: 'success' - Request status
 *
 * @returns {Response} GET with action=health returns RUM health status:
 *   - healthy: boolean - Configuration status
 *   - status: 'configured' | 'missing-config' - Configuration state
 *   - configuration: { hasApplicationId, hasClientToken, site } - Config details
 *   - features: { sessionReplay, userTracking, performanceMonitoring, errorTracking } - Feature status
 *
 * @returns {Response} GET with action=features returns available features:
 *   - features: { [key]: { enabled, description }} - RUM feature catalog
 *
 * @returns {Response} POST tracks RUM events with body:
 *   - action: 'track_conversion' | 'track_feature_usage' | 'track_user_journey' | 'track_performance'
 *   - data: { type, value, userId, feature, flow, step, metric, context } - Event data
 *
 * @example
 * // GET Request - RUM configuration
 * GET /api/monitoring/rum?action=config
 *
 * // Response
 * {
 *   "rum": {
 *     "enabled": true,
 *     "applicationId": "abc123",
 *     "site": "datadoghq.com",
 *     "service": "vibecode-webgui",
 *     "features": {
 *       "sessionReplay": true,
 *       "userInteractions": true,
 *       "webVitals": true
 *     }
 *   }
 * }
 *
 * // POST Request - Track conversion
 * POST /api/monitoring/rum
 * {
 *   "action": "track_conversion",
 *   "data": { "type": "signup", "value": 1, "userId": "user_123" }
 * }
 *
 * // Response
 * { "success": true, "message": "Conversion tracked successfully" }
 *
 * // POST Request - Track feature usage
 * POST /api/monitoring/rum
 * {
 *   "action": "track_feature_usage",
 *   "data": { "feature": "code_editor", "action": "save", "userId": "user_123" }
 * }
 *
 * @throws {400} Invalid action - Unknown action type
 * @throws {500} Internal server error - RUM API or tracking error
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRUMPublicConfig } from '@/lib/monitoring/datadog-env'

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'config'

    switch (action) {
      case 'config':
        // Return RUM configuration for client-side initialization
        const { applicationId, clientToken, site, env, version } = getRUMPublicConfig()
        const rumConfig = {
          enabled: !!(applicationId && clientToken),
          applicationId: applicationId || '',
          site: site || 'datadoghq.com',
          service: 'vibecode-webgui',
          env: env || 'development',
          version: version || '1.0.0',
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
        const { applicationId: appId, clientToken: token, site: publicSite } = getRUMPublicConfig()
        const isConfigured = !!(appId && token)

        return NextResponse.json({
          healthy: isConfigured,
          status: isConfigured ? 'configured' : 'missing-config',
          configuration: {
            hasApplicationId: !!appId,
            hasClientToken: !!token,
            site: publicSite || 'datadoghq.com'
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