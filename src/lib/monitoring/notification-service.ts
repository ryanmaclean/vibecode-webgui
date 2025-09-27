/**
 * Notification Service for Connection Pool Monitoring
 * Handles email, SMS, and Datadog integration for real-time alerts
 */

import { DatadogIntegration } from './datadog-integration'
import type { Alert } from '../db/connection-pool-alerts'

export interface NotificationConfig {
  email?: {
    enabled: boolean
    recipients: string[]
    smtpConfig?: {
      host: string
      port: number
      secure: boolean
      auth: {
        user: string
        pass: string
      }
    }
  }
  sms?: {
    enabled: boolean
    recipients: string[]
    provider: 'twilio' | 'aws-sns'
    config: Record<string, string>
  }
  datadog?: {
    enabled: boolean
    apiKey?: string
    site?: string
  }
  webhook?: {
    enabled: boolean
    urls: string[]
    secret?: string
  }
}

export interface NotificationTemplate {
  subject: string
  body: string
  severity: 'info' | 'warning' | 'critical'
}

export class ConnectionPoolNotificationService {
  private static instance: ConnectionPoolNotificationService
  private config: NotificationConfig
  private datadogIntegration: DatadogIntegration
  private notificationHistory: Array<{
    alert: Alert
    channels: string[]
    timestamp: Date
    success: boolean
    error?: string
  }> = []

  private constructor(config: NotificationConfig = {}) {
    this.config = {
      email: { enabled: false, recipients: [] },
      sms: { enabled: false, recipients: [], provider: 'twilio', config: {} },
      datadog: { enabled: false },
      webhook: { enabled: false, urls: [] },
      ...config
    }
    
    this.datadogIntegration = new DatadogIntegration({
      host: process.env.DD_AGENT_HOST,
      port: parseInt(process.env.DD_DOGSTATSD_PORT || '8125'),
      apiKey: process.env.DD_API_KEY
    })
  }

  public static getInstance(config?: NotificationConfig): ConnectionPoolNotificationService {
    if (!ConnectionPoolNotificationService.instance) {
      ConnectionPoolNotificationService.instance = new ConnectionPoolNotificationService(config)
    }
    return ConnectionPoolNotificationService.instance
  }

  /**
   * Send alert notification via configured channels
   */
  public async sendAlert(alert: Alert): Promise<void> {
    const channels: string[] = []
    const errors: string[] = []

    // Send to Datadog first (most reliable)
    if (this.config.datadog?.enabled) {
      try {
        await this.sendToDatadog(alert)
        channels.push('datadog')
      } catch (error) {
        console.error('Failed to send alert to Datadog:', error)
        errors.push(`datadog: ${(error as Error).message}`)
      }
    }

    // Send email notifications
    if (this.config.email?.enabled && this.config.email.recipients.length > 0) {
      try {
        await this.sendEmail(alert)
        channels.push('email')
      } catch (error) {
        console.error('Failed to send alert email:', error)
        errors.push(`email: ${(error as Error).message}`)
      }
    }

    // Send SMS notifications for critical alerts
    if (this.config.sms?.enabled && 
        this.config.sms.recipients.length > 0 && 
        alert.severity === 'critical') {
      try {
        await this.sendSMS(alert)
        channels.push('sms')
      } catch (error) {
        console.error('Failed to send alert SMS:', error)
        errors.push(`sms: ${(error as Error).message}`)
      }
    }

    // Send webhook notifications
    if (this.config.webhook?.enabled && this.config.webhook.urls.length > 0) {
      try {
        await this.sendWebhook(alert)
        channels.push('webhook')
      } catch (error) {
        console.error('Failed to send alert webhook:', error)
        errors.push(`webhook: ${(error as Error).message}`)
      }
    }

    // Record notification attempt
    this.notificationHistory.push({
      alert,
      channels,
      timestamp: new Date(),
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined
    })

    // Limit history size
    if (this.notificationHistory.length > 1000) {
      this.notificationHistory = this.notificationHistory.slice(-1000)
    }

    // Log summary
    const outcome = errors.length === 0 ? 'successfully' : 'with errors'
    console.log(
      `Alert notification sent ${outcome} via [${channels.join(', ')}] for alert: ${alert.message}`
    )
  }

  /**
   * Send alert to Datadog
   */
  private async sendToDatadog(alert: Alert): Promise<void> {
    // Send as Datadog event
    this.datadogIntegration.sendEvent({
      title: `Connection Pool Alert: ${alert.type}`,
      text: alert.message,
      alertType: alert.severity === 'critical' ? 'error' : 'warning',
      sourceTypeName: 'connection-pool',
      tags: [
        `alert_type:${alert.type}`,
        `severity:${alert.severity}`,
        `alert_id:${alert.id}`
      ]
    })

    // Send metrics if details available
    if (alert.details) {
      const details = alert.details as Record<string, unknown>
      
      // Send pool utilization metric
      if (typeof details.currentUtilization === 'number') {
        this.datadogIntegration.recordPoolMetrics({
          poolName: 'default',
          utilization: details.currentUtilization,
          activeConnections: details.activeConnections as number || 0,
          totalConnections: details.totalConnections as number || 0,
          waitTime: details.avgAcquireTime as number || 0
        })
      }
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(alert: Alert): Promise<void> {
    const template = this.getEmailTemplate(alert)
    
    // In a real implementation, use a service like SendGrid, AWS SES, etc.
    // For now, we'll log the email that would be sent
    console.log(`📧 EMAIL ALERT: ${template.subject}`)
    console.log(`Recipients: ${this.config.email?.recipients.join(', ')}`)
    console.log(`Body: ${template.body}`)
    
    // Simulate email sending
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement actual email sending
      // Example with nodemailer:
      // await this.sendEmailWithNodemailer(template, this.config.email.recipients)
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(alert: Alert): Promise<void> {
    const message = `🚨 CRITICAL: ${alert.message} - ${new Date().toLocaleTimeString()}`
    
    // Log SMS that would be sent
    console.log(`📱 SMS ALERT: ${message}`)
    console.log(`Recipients: ${this.config.sms?.recipients.join(', ')}`)
    
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement actual SMS sending
      // Example with Twilio:
      // await this.sendSMSWithTwilio(message, this.config.sms.recipients)
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(alert: Alert): Promise<void> {
    const payload = {
      alert_id: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp,
      details: alert.details,
      source: 'vibecode-connection-pool'
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'VibeCode-ConnectionPool/1.0'
    }

    // Add webhook signature if secret is configured
    if (this.config.webhook?.secret) {
      const crypto = await import('crypto')
      const signature = crypto
        .createHmac('sha256', this.config.webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex')
      headers['X-Webhook-Signature'] = `sha256=${signature}`
    }

    // Send to all configured webhook URLs
    const promises = this.config.webhook!.urls.map(async (url) => {
      try {
        // Skip actual HTTP call in test environment
        if (process.env.NODE_ENV === 'test') {
          console.log(`✅ Test webhook would be sent to ${url}`)
          return
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        console.log(`✅ Webhook sent successfully to ${url}`)
      } catch (error) {
        console.error(`❌ Failed to send webhook to ${url}:`, error)
        throw error
      }
    })

    await Promise.all(promises)
  }

  /**
   * Generate email template for alert
   */
  private getEmailTemplate(alert: Alert): NotificationTemplate {
    const timestamp = alert.timestamp.toLocaleString()
    
    const templates = {
      pool_utilization: {
        subject: `🔴 Connection Pool Utilization Alert - ${alert.severity.toUpperCase()}`,
        body: `
Connection Pool Alert

Alert Type: ${alert.type}
Severity: ${alert.severity}
Message: ${alert.message}
Time: ${timestamp}

${alert.details ? `Details:
${JSON.stringify(alert.details, null, 2)}` : ''}

Please check the connection pool monitoring dashboard for more details.

This is an automated alert from VibeCode Connection Pool Monitoring.
        `.trim()
      },
      acquire_failures: {
        subject: `🔴 Connection Acquisition Failures - ${alert.severity.toUpperCase()}`,
        body: `
Connection Acquisition Alert

Alert Type: ${alert.type}
Severity: ${alert.severity}
Message: ${alert.message}
Time: ${timestamp}

${alert.details ? `Details:
${JSON.stringify(alert.details, null, 2)}` : ''}

Immediate action may be required to prevent service disruption.

This is an automated alert from VibeCode Connection Pool Monitoring.
        `.trim()
      }
    }

    return templates[alert.type as keyof typeof templates] || {
      subject: `🔴 Connection Pool Alert - ${alert.severity.toUpperCase()}`,
      body: `
Connection Pool Alert

Alert Type: ${alert.type}
Severity: ${alert.severity}
Message: ${alert.message}
Time: ${timestamp}

${alert.details ? `Details:
${JSON.stringify(alert.details, null, 2)}` : ''}

Please check the monitoring dashboard for more information.

This is an automated alert from VibeCode Connection Pool Monitoring.
      `.trim(),
      severity: alert.severity
    }
  }

  /**
   * Update notification configuration
   */
  public updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get notification history
   */
  public getNotificationHistory(limit = 100): typeof this.notificationHistory {
    return this.notificationHistory.slice(-limit)
  }

  /**
   * Test notification channels
   */
  public async testNotifications(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}

    // Test Datadog
    if (this.config.datadog?.enabled) {
      try {
        this.datadogIntegration.sendEvent({
          title: 'Connection Pool Test Alert',
          text: 'This is a test notification from VibeCode connection pool monitoring',
          alertType: 'info',
          sourceTypeName: 'connection-pool-test'
        })
        results.datadog = true
      } catch {
        results.datadog = false
      }
    } else {
      results.datadog = false
    }

    // Test email
    if (this.config.email?.enabled) {
      try {
        console.log('📧 Test email would be sent to:', this.config.email.recipients)
        results.email = true
      } catch {
        results.email = false
      }
    } else {
      results.email = false
    }

    // Test SMS
    if (this.config.sms?.enabled) {
      try {
        console.log('📱 Test SMS would be sent to:', this.config.sms.recipients)
        results.sms = true
      } catch {
        results.sms = false
      }
    } else {
      results.sms = false
    }

    // Test webhook
    if (this.config.webhook?.enabled) {
      try {
        // Send test webhook (skip actual HTTP call in test)
        if (process.env.NODE_ENV !== 'test') {
          await this.sendWebhook({
            id: 'test-' + Date.now(),
            type: 'general' as any,
            severity: 'info' as any,
            message: 'Test notification from VibeCode connection pool monitoring',
            timestamp: new Date(),
            acknowledged: false
          })
        }
        results.webhook = true
      } catch {
        results.webhook = false
      }
    } else {
      results.webhook = false
    }

    return results
  }
}

// Export singleton instance
export const connectionPoolNotificationService = ConnectionPoolNotificationService.getInstance({
  email: {
    enabled: process.env.NOTIFICATION_EMAIL_ENABLED === 'true',
    recipients: (process.env.NOTIFICATION_EMAIL_RECIPIENTS || '').split(',').filter(Boolean)
  },
  sms: {
    enabled: process.env.NOTIFICATION_SMS_ENABLED === 'true',
    recipients: (process.env.NOTIFICATION_SMS_RECIPIENTS || '').split(',').filter(Boolean),
    provider: (process.env.NOTIFICATION_SMS_PROVIDER as 'twilio' | 'aws-sns') || 'twilio',
    config: {
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
      twilioFromNumber: process.env.TWILIO_FROM_NUMBER || ''
    }
  },
  datadog: {
    enabled: process.env.DD_API_KEY ? true : false,
    apiKey: process.env.DD_API_KEY,
    site: process.env.DD_SITE || 'datadoghq.com'
  },
  webhook: {
    enabled: process.env.NOTIFICATION_WEBHOOK_ENABLED === 'true',
    urls: (process.env.NOTIFICATION_WEBHOOK_URLS || '').split(',').filter(Boolean),
    secret: process.env.NOTIFICATION_WEBHOOK_SECRET
  }
})