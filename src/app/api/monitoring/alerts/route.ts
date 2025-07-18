/**
 * Monitoring alerts API endpoint
 * Provides real-time alerts from Datadog for the monitoring dashboard
 * Updated for 2025 with modern Datadog API integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { client, v1 } from '@datadog/datadog-api-client'

// Datadog API client configuration
const createDatadogConfig = () => {
  const configuration = client.createConfiguration()
  configuration.setServerVariables({
    site: process.env.DATADOG_SITE || 'datadoghq.com',
  })
  return configuration
}

// Initialize Datadog monitors API client
const getMonitorsApi = () => {
  if (!process.env.DATADOG_API_KEY) {
    return null
  }
  return new v1.MonitorsApi(createDatadogConfig())
}

interface AlertItem {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  timestamp: string
  resolved: boolean
}

export async function GET(_request: NextRequest) {
  try {
    // Verify admin access
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Skip Datadog API calls if not configured
    if (!process.env.DATADOG_API_KEY) {
      console.warn('Datadog API key not configured, returning empty alerts')
      return NextResponse.json({ alerts: [] })
    }

    try {
      // Query Datadog for monitors/alerts
      const monitorsApi = getMonitorsApi()
      if (!monitorsApi) {
        return NextResponse.json({ alerts: [] })
      }

      const monitorsResponse = await monitorsApi.listMonitors({
        tags: 'service:vibecode-webgui',
        monitorTags: 'vibecode',
        withDowntimes: true,
      })

      // Transform Datadog monitors to our alert format
      const alerts: AlertItem[] = monitorsResponse
        .filter((monitor: unknown) => {
          const typedMonitor = monitor as { overallState?: string }
          return typedMonitor.overallState !== 'OK'
        })
        .map((monitor: unknown) => {
          const typedMonitor = monitor as {
            id?: number
            overallState?: string
            name?: string
            message?: string
            modified?: number
          }
          return {
            id: (typedMonitor.id || 0).toString(),
            severity: mapSeverity(typedMonitor.overallState || 'Unknown'),
            title: typedMonitor.name || 'Unknown Monitor',
            description: typedMonitor.message || 'No description available',
            timestamp: new Date((typedMonitor.modified || 0) * 1000).toISOString(),
            resolved: typedMonitor.overallState === 'OK',
          }
        })

      return NextResponse.json({ alerts })
    } catch (datadogError) {
      console.error('Datadog alerts API error:', datadogError)
      // Return empty alerts array if Datadog is unavailable
      return NextResponse.json({ alerts: [] })
    }
  } catch (error) {
    console.error('Alerts API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
}

// Helper functions

function mapSeverity(overallState: string): 'low' | 'medium' | 'high' | 'critical' {
  switch (overallState) {
    case 'Alert':
      return 'critical'
    case 'Warn':
      return 'high'
    case 'No Data':
      return 'medium'
    case 'OK':
      return 'low'
    default:
      return 'medium'
  }
}
