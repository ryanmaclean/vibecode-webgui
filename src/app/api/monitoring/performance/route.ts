/**
 * Performance Monitoring API Endpoint
 * Provides performance metrics, reports, and test result submission
 */

import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor } from '../../../../lib/monitoring/performance-monitoring'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'report'
    const timeframe = searchParams.get('timeframe') || '1h'

    switch (action) {
      case 'report':
        const report = performanceMonitor.generatePerformanceReport(timeframe)
        
        return NextResponse.json({
          ...report,
          timestamp: new Date().toISOString(),
          status: 'success'
        })

      case 'health':
        // Quick performance health check
        const healthReport = performanceMonitor.generatePerformanceReport('15m')
        const isHealthy = 
          healthReport.critical_issues.length === 0 && 
          healthReport.summary.avg_api_response_time < 1000

        return NextResponse.json({
          healthy: isHealthy,
          status: isHealthy ? 'healthy' : 'degraded',
          issues: healthReport.critical_issues,
          recommendations: healthReport.recommendations.slice(0, 3), // Top 3 recommendations
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({
          error: 'Invalid action',
          available_actions: ['report', 'health']
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Performance API error:', error)
    
    return NextResponse.json({
      error: 'Failed to retrieve performance data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    switch (type) {
      case 'load_test_results':
        const loadTestPassed = await performanceMonitor.submitLoadTestResults(data)
        
        return NextResponse.json({
          success: true,
          test_passed: loadTestPassed,
          message: `Load test results processed: ${loadTestPassed ? 'PASSED' : 'FAILED'}`,
          timestamp: new Date().toISOString()
        })

      case 'synthetic_test_results':
        const syntheticTestPassed = await performanceMonitor.submitSyntheticTestResults(data)
        
        return NextResponse.json({
          success: true,
          test_passed: syntheticTestPassed,
          message: `Datadog Synthetic test results processed: ${syntheticTestPassed ? 'PASSED' : 'FAILED'}`,
          timestamp: new Date().toISOString()
        })

      case 'lighthouse_results':
        const lighthousePassed = await performanceMonitor.submitLighthouseResults(data)
        
        return NextResponse.json({
          success: true,
          audit_passed: lighthousePassed,
          message: `Lighthouse audit processed: ${lighthousePassed ? 'PASSED' : 'FAILED'}`,
          timestamp: new Date().toISOString()
        })

      case 'web_vitals':
        performanceMonitor.trackWebVitals(data)
        
        return NextResponse.json({
          success: true,
          message: 'Web Vitals metric recorded',
          timestamp: new Date().toISOString()
        })

      case 'api_performance':
        performanceMonitor.trackAPIPerformance(
          data.endpoint,
          data.method,
          data.responseTime,
          data.status
        )
        
        return NextResponse.json({
          success: true,
          message: 'API performance metric recorded',
          timestamp: new Date().toISOString()
        })

      case 'resource_performance':
        performanceMonitor.trackResourceLoading(data)
        
        return NextResponse.json({
          success: true,
          message: 'Resource performance metric recorded',
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({
          error: 'Invalid performance data type',
          available_types: [
            'load_test_results',
            'lighthouse_results', 
            'web_vitals',
            'api_performance',
            'resource_performance'
          ]
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Performance submission error:', error)
    
    return NextResponse.json({
      error: 'Failed to process performance data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}