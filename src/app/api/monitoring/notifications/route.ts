/**
 * API endpoint for managing connection pool monitoring notifications
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectionPoolNotificationService } from '@/lib/monitoring/notification-service'
import type { NotificationConfig } from '@/lib/monitoring/notification-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'test':
        // Test all notification channels
        const testResults = await connectionPoolNotificationService.testNotifications()
        return NextResponse.json({
          success: true,
          testResults,
          message: 'Notification test completed'
        })

      case 'history':
        // Get notification history
        const limit = parseInt(searchParams.get('limit') || '50')
        const history = connectionPoolNotificationService.getNotificationHistory(limit)
        return NextResponse.json({
          success: true,
          history,
          count: history.length
        })

      default:
        // Get current configuration (don't expose sensitive data)
        return NextResponse.json({
          success: true,
          config: {
            email: {
              enabled: process.env.NOTIFICATION_EMAIL_ENABLED === 'true',
              recipientCount: (process.env.NOTIFICATION_EMAIL_RECIPIENTS || '').split(',').filter(Boolean).length
            },
            sms: {
              enabled: process.env.NOTIFICATION_SMS_ENABLED === 'true',
              recipientCount: (process.env.NOTIFICATION_SMS_RECIPIENTS || '').split(',').filter(Boolean).length,
              provider: process.env.NOTIFICATION_SMS_PROVIDER || 'twilio'
            },
            datadog: {
              enabled: Boolean(process.env.DD_API_KEY)
            },
            webhook: {
              enabled: process.env.NOTIFICATION_WEBHOOK_ENABLED === 'true',
              urlCount: (process.env.NOTIFICATION_WEBHOOK_URLS || '').split(',').filter(Boolean).length
            }
          }
        })
    }
  } catch (error) {
    console.error('Error in notifications API:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: (error as Error).message 
      }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, config } = body

    switch (action) {
      case 'update':
        // Update notification configuration
        if (config && typeof config === 'object') {
          connectionPoolNotificationService.updateConfig(config as Partial<NotificationConfig>)
          return NextResponse.json({
            success: true,
            message: 'Notification configuration updated'
          })
        } else {
          return NextResponse.json(
            { success: false, error: 'Invalid configuration data' },
            { status: 400 }
          )
        }

      case 'test-alert':
        // Send a test alert
        const testAlert = {
          id: `test-${Date.now()}`,
          type: 'general' as const,
          severity: 'info' as const,
          message: 'This is a test alert from VibeCode Connection Pool Monitoring',
          timestamp: new Date(),
          acknowledged: false,
          details: {
            test: true,
            source: 'api',
            timestamp: new Date().toISOString()
          }
        }

        await connectionPoolNotificationService.sendAlert(testAlert)
        
        return NextResponse.json({
          success: true,
          message: 'Test alert sent successfully',
          alertId: testAlert.id
        })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in notifications API:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: (error as Error).message 
      }, 
      { status: 500 }
    )
  }
}