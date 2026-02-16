/**
 * Expiration Checker - Secret expiration detection and alerting
 *
 * Monitors secret expiration status and provides alerting capabilities for proactive
 * secret lifecycle management. Integrates with rotation policies for threshold-based warnings.
 *
 * Features:
 * - Individual secret expiration checks
 * - Bulk expiration detection with filters
 * - Configurable alert thresholds
 * - Severity-based alert generation
 * - Integration with rotation policies
 * - Structured logging for audit trails
 */

import { PrismaClient } from '@prisma/client'
import { createChildLogger } from '@/lib/logger'

const logger = createChildLogger({ module: 'security', scope: 'expiration-checker' })

/**
 * Alert severity levels
 */
export type AlertSeverity = 'critical' | 'warning' | 'info'

/**
 * Alert thresholds configuration
 */
export interface ExpirationThresholds {
  /** Days threshold for critical alerts (immediate action required) */
  critical: number
  /** Days threshold for warning alerts (plan rotation soon) */
  warning: number
  /** Days threshold for info alerts (rotation recommended) */
  info: number
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  /** Enable/disable notifications */
  enabled: boolean
  /** Minimum severity level to trigger notifications */
  minSeverity?: AlertSeverity
  /** Renotify interval in minutes (prevent alert fatigue) */
  renotifyInterval?: number
  /** Include rotation policy recommendations */
  includeRecommendations?: boolean
}

/**
 * Expiration status result
 */
export interface ExpirationStatus {
  keyName: string
  status: 'active' | 'expiring_soon' | 'expired' | 'no_expiration'
  expiresAt: Date | null
  daysUntilExpiration: number | null
  severity: AlertSeverity | null
  rotationPolicy: string | null
  message: string
}

/**
 * Alert result for expiring/expired secrets
 */
export interface ExpirationAlert {
  keyName: string
  severity: AlertSeverity
  expiresAt: Date | null
  daysUntilExpiration: number | null
  rotationPolicy: string | null
  message: string
  timestamp: Date
}

/**
 * Options for expiration checking
 */
export interface ExpirationCheckOptions {
  /** Custom threshold in days for "expiring soon" status */
  thresholdDays?: number
  /** Include secrets without expiration dates */
  includeNoExpiration?: boolean
}

/**
 * Summary of expiration status across all secrets
 */
export interface ExpirationSummary {
  total: number
  active: number
  expiringSoon: number
  expired: number
  noExpiration: number
  alerts: ExpirationAlert[]
  timestamp: Date
}

/**
 * Default expiration thresholds
 */
const DEFAULT_THRESHOLDS: ExpirationThresholds = {
  critical: 7,  // 7 days or less = critical
  warning: 14,  // 14 days or less = warning
  info: 30,     // 30 days or less = info
}

/**
 * Default notification configuration
 */
const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  minSeverity: 'info',
  renotifyInterval: 60, // 1 hour
  includeRecommendations: true,
}

/**
 * ExpirationChecker class - Monitors and alerts on secret expiration
 */
export class ExpirationChecker {
  private prisma: PrismaClient
  private thresholds: ExpirationThresholds
  private notificationConfig: NotificationConfig
  private lastNotificationTimes: Map<string, Date>

  constructor(
    prisma: PrismaClient,
    thresholds: Partial<ExpirationThresholds> = {},
    notificationConfig: Partial<NotificationConfig> = {}
  ) {
    this.prisma = prisma
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds }
    this.notificationConfig = { ...DEFAULT_NOTIFICATION_CONFIG, ...notificationConfig }
    this.lastNotificationTimes = new Map()

    logger.info('ExpirationChecker initialized', {
      thresholds: this.thresholds,
      notificationEnabled: this.notificationConfig.enabled,
    })
  }

  /**
   * Check expiration status for a specific secret
   *
   * @param keyName - Secret identifier
   * @param options - Check options including custom threshold
   * @returns Expiration status with severity and message
   */
  async checkExpiration(
    keyName: string,
    options: ExpirationCheckOptions = {}
  ): Promise<ExpirationStatus | null> {
    const thresholdDays = options.thresholdDays || 30

    try {
      // Fetch secret metadata
      const metadata = await this.prisma.secretMetadata.findUnique({
        where: { key_name: keyName },
      })

      if (!metadata) {
        logger.debug('Secret metadata not found', { keyName })
        return null
      }

      // Handle secrets without expiration
      if (!metadata.expires_at) {
        return {
          keyName,
          status: 'no_expiration',
          expiresAt: null,
          daysUntilExpiration: null,
          severity: null,
          rotationPolicy: metadata.rotation_policy,
          message: 'Secret has no expiration date configured',
        }
      }

      // Calculate days until expiration
      const now = new Date()
      const expiresAt = new Date(metadata.expires_at)
      const daysUntilExpiration = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Determine status and severity using configurable thresholds
      let status: ExpirationStatus['status']
      let severity: AlertSeverity | null = null
      let message: string

      if (daysUntilExpiration < 0) {
        status = 'expired'
        severity = 'critical'
        message = this.buildAlertMessage(
          'EXPIRED',
          keyName,
          `Secret expired ${Math.abs(daysUntilExpiration)} days ago`,
          'Rotate immediately to restore security',
          metadata.rotation_policy
        )
      } else if (daysUntilExpiration <= this.thresholds.critical) {
        status = 'expiring_soon'
        severity = 'critical'
        message = this.buildAlertMessage(
          'CRITICAL',
          keyName,
          `Secret expires in ${daysUntilExpiration} day(s)`,
          'Immediate rotation required',
          metadata.rotation_policy
        )
      } else if (daysUntilExpiration <= this.thresholds.warning) {
        status = 'expiring_soon'
        severity = 'warning'
        message = this.buildAlertMessage(
          'WARNING',
          keyName,
          `Secret expires in ${daysUntilExpiration} days`,
          'Plan rotation within the next week',
          metadata.rotation_policy
        )
      } else if (daysUntilExpiration <= this.thresholds.info) {
        status = 'expiring_soon'
        severity = 'info'
        message = this.buildAlertMessage(
          'INFO',
          keyName,
          `Secret expires in ${daysUntilExpiration} days`,
          'Consider scheduling rotation',
          metadata.rotation_policy
        )
      } else {
        status = 'active'
        severity = null
        message = `Secret expires in ${daysUntilExpiration} days`
      }

      logger.debug('Expiration check completed', {
        keyName,
        status,
        daysUntilExpiration,
        severity,
      })

      return {
        keyName,
        status,
        expiresAt,
        daysUntilExpiration,
        severity,
        rotationPolicy: metadata.rotation_policy,
        message,
      }
    } catch (error) {
      logger.error('Failed to check expiration', {
        error: error instanceof Error ? error.message : error,
        keyName,
      })
      throw new Error(`Expiration check failed for ${keyName}`)
    }
  }

  /**
   * Get all secrets expiring within threshold
   *
   * @param options - Check options including custom threshold
   * @returns Array of secrets expiring soon
   */
  async getExpiringSoon(
    options: ExpirationCheckOptions = {}
  ): Promise<ExpirationStatus[]> {
    const thresholdDays = options.thresholdDays || 30

    try {
      const now = new Date()
      const thresholdDate = new Date(now)
      thresholdDate.setDate(thresholdDate.getDate() + thresholdDays)

      // Query secrets expiring within threshold
      const secrets = await this.prisma.secretMetadata.findMany({
        where: {
          expires_at: {
            lte: thresholdDate,
            gte: now,
          },
          status: {
            not: 'revoked',
          },
        },
        orderBy: {
          expires_at: 'asc',
        },
      })

      logger.info('Found secrets expiring soon', {
        count: secrets.length,
        thresholdDays,
      })

      // Map to expiration status
      const results: ExpirationStatus[] = []
      for (const secret of secrets) {
        const status = await this.checkExpiration(secret.key_name, options)
        if (status && status.status === 'expiring_soon') {
          results.push(status)
        }
      }

      return results
    } catch (error) {
      logger.error('Failed to get expiring soon secrets', {
        error: error instanceof Error ? error.message : error,
      })
      throw new Error('Failed to retrieve expiring soon secrets')
    }
  }

  /**
   * Get all expired secrets
   *
   * @returns Array of expired secrets
   */
  async getExpired(): Promise<ExpirationStatus[]> {
    try {
      const now = new Date()

      // Query expired secrets
      const secrets = await this.prisma.secretMetadata.findMany({
        where: {
          expires_at: {
            lt: now,
          },
          status: {
            not: 'revoked',
          },
        },
        orderBy: {
          expires_at: 'asc',
        },
      })

      logger.info('Found expired secrets', {
        count: secrets.length,
      })

      // Map to expiration status
      const results: ExpirationStatus[] = []
      for (const secret of secrets) {
        const status = await this.checkExpiration(secret.key_name)
        if (status && status.status === 'expired') {
          results.push(status)
        }
      }

      return results
    } catch (error) {
      logger.error('Failed to get expired secrets', {
        error: error instanceof Error ? error.message : error,
      })
      throw new Error('Failed to retrieve expired secrets')
    }
  }

  /**
   * Get comprehensive summary of all secret expiration status
   *
   * @param options - Check options
   * @returns Summary with counts and alerts
   */
  async getSummary(
    options: ExpirationCheckOptions = {}
  ): Promise<ExpirationSummary> {
    try {
      const includeNoExpiration = options.includeNoExpiration || false

      // Get all active secrets
      const secrets = await this.prisma.secretMetadata.findMany({
        where: {
          status: {
            not: 'revoked',
          },
        },
      })

      let active = 0
      let expiringSoon = 0
      let expired = 0
      let noExpiration = 0
      const alerts: ExpirationAlert[] = []

      // Check each secret
      for (const secret of secrets) {
        const status = await this.checkExpiration(secret.key_name, options)

        if (!status) {
          continue
        }

        // Count by status
        switch (status.status) {
          case 'active':
            active++
            break
          case 'expiring_soon':
            expiringSoon++
            if (status.severity) {
              alerts.push({
                keyName: status.keyName,
                severity: status.severity,
                expiresAt: status.expiresAt,
                daysUntilExpiration: status.daysUntilExpiration,
                rotationPolicy: status.rotationPolicy,
                message: status.message,
                timestamp: new Date(),
              })
            }
            break
          case 'expired':
            expired++
            if (status.severity) {
              alerts.push({
                keyName: status.keyName,
                severity: status.severity,
                expiresAt: status.expiresAt,
                daysUntilExpiration: status.daysUntilExpiration,
                rotationPolicy: status.rotationPolicy,
                message: status.message,
                timestamp: new Date(),
              })
            }
            break
          case 'no_expiration':
            noExpiration++
            break
        }
      }

      // Sort alerts by severity and days until expiration
      alerts.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 }
        if (a.severity !== b.severity) {
          return severityOrder[a.severity] - severityOrder[b.severity]
        }
        return (a.daysUntilExpiration || 0) - (b.daysUntilExpiration || 0)
      })

      logger.info('Generated expiration summary', {
        total: secrets.length,
        active,
        expiringSoon,
        expired,
        noExpiration,
        alertCount: alerts.length,
      })

      return {
        total: secrets.length,
        active,
        expiringSoon,
        expired,
        noExpiration,
        alerts,
        timestamp: new Date(),
      }
    } catch (error) {
      logger.error('Failed to generate expiration summary', {
        error: error instanceof Error ? error.message : error,
      })
      throw new Error('Failed to generate expiration summary')
    }
  }

  /**
   * Send alerts for expiring and expired secrets
   *
   * Logs structured alerts with appropriate severity levels for monitoring integration.
   * Can be extended to integrate with external alerting systems (PagerDuty, Slack, etc.)
   *
   * @param options - Check options
   * @returns Array of generated alerts
   */
  async sendAlerts(
    options: ExpirationCheckOptions = {}
  ): Promise<ExpirationAlert[]> {
    try {
      // Check if notifications are enabled
      if (!this.notificationConfig.enabled) {
        logger.debug('Notifications disabled, skipping alerts')
        return []
      }

      // Get summary with all alerts
      const summary = await this.getSummary(options)
      const { alerts } = summary

      if (alerts.length === 0) {
        logger.info('No expiration alerts to send')
        return []
      }

      // Filter by minimum severity if configured
      const filteredAlerts = this.filterAlertsBySeverity(alerts)

      // Apply renotification throttling
      const alertsToSend = this.applyRenotificationThrottling(filteredAlerts)

      if (alertsToSend.length === 0) {
        logger.debug('No alerts to send after filtering and throttling')
        return []
      }

      // Send alerts with appropriate severity
      for (const alert of alertsToSend) {
        const metadata = {
          keyName: alert.keyName,
          expiresAt: alert.expiresAt,
          daysUntilExpiration: alert.daysUntilExpiration,
          rotationPolicy: alert.rotationPolicy,
          severity: alert.severity,
        }

        switch (alert.severity) {
          case 'critical':
            logger.error(alert.message, metadata)
            break
          case 'warning':
            logger.warn(alert.message, metadata)
            break
          case 'info':
            logger.info(alert.message, metadata)
            break
        }

        // Update last notification time
        this.lastNotificationTimes.set(alert.keyName, new Date())
      }

      logger.info('Sent expiration alerts', {
        totalAlerts: alertsToSend.length,
        critical: alertsToSend.filter((a) => a.severity === 'critical').length,
        warning: alertsToSend.filter((a) => a.severity === 'warning').length,
        info: alertsToSend.filter((a) => a.severity === 'info').length,
        filtered: alerts.length - filteredAlerts.length,
        throttled: filteredAlerts.length - alertsToSend.length,
      })

      return alertsToSend
    } catch (error) {
      logger.error('Failed to send alerts', {
        error: error instanceof Error ? error.message : error,
      })
      throw new Error('Failed to send expiration alerts')
    }
  }

  /**
   * Get secrets by status filter
   *
   * @param status - Status to filter by
   * @param options - Check options
   * @returns Array of secrets matching status
   */
  async getSecretsByStatus(
    status: ExpirationStatus['status'],
    options: ExpirationCheckOptions = {}
  ): Promise<ExpirationStatus[]> {
    try {
      let whereClause: any = {
        status: {
          not: 'revoked',
        },
      }

      const now = new Date()
      const thresholdDays = options.thresholdDays || 30
      const thresholdDate = new Date(now)
      thresholdDate.setDate(thresholdDate.getDate() + thresholdDays)

      // Build query based on status
      switch (status) {
        case 'expired':
          whereClause.expires_at = { lt: now }
          break
        case 'expiring_soon':
          whereClause.expires_at = {
            gte: now,
            lte: thresholdDate,
          }
          break
        case 'active':
          whereClause.expires_at = { gt: thresholdDate }
          break
        case 'no_expiration':
          whereClause.expires_at = null
          break
      }

      const secrets = await this.prisma.secretMetadata.findMany({
        where: whereClause,
        orderBy: {
          expires_at: 'asc',
        },
      })

      const results: ExpirationStatus[] = []
      for (const secret of secrets) {
        const statusResult = await this.checkExpiration(secret.key_name, options)
        if (statusResult && statusResult.status === status) {
          results.push(statusResult)
        }
      }

      logger.info('Retrieved secrets by status', {
        status,
        count: results.length,
      })

      return results
    } catch (error) {
      logger.error('Failed to get secrets by status', {
        error: error instanceof Error ? error.message : error,
        status,
      })
      throw new Error(`Failed to retrieve secrets with status: ${status}`)
    }
  }

  /**
   * Build structured alert message following monitoring best practices
   *
   * @param level - Alert level (CRITICAL, WARNING, INFO, EXPIRED)
   * @param keyName - Secret identifier
   * @param summary - Brief summary of the issue
   * @param action - Recommended action
   * @param rotationPolicy - Current rotation policy if any
   * @returns Formatted alert message
   */
  private buildAlertMessage(
    level: string,
    keyName: string,
    summary: string,
    action: string,
    rotationPolicy: string | null
  ): string {
    const parts = [`**${level}: Secret Expiration Alert**`, '', summary]

    if (this.notificationConfig.includeRecommendations) {
      parts.push('', `**Impact**: Secret "${keyName}" may become invalid`)
      parts.push(`**Action Required**: ${action}`)

      if (rotationPolicy) {
        parts.push(`**Rotation Policy**: ${rotationPolicy}`)
        parts.push(
          '**Next Steps**: ',
          '- Review current secret usage',
          '- Plan rotation according to policy',
          '- Update dependent services',
          '- Verify rotation completion'
        )
      } else {
        parts.push('**Recommendation**: Configure a rotation policy for automated management')
      }
    }

    return parts.join('\n')
  }

  /**
   * Filter alerts by minimum severity level
   *
   * @param alerts - All alerts
   * @returns Filtered alerts meeting minimum severity
   */
  private filterAlertsBySeverity(alerts: ExpirationAlert[]): ExpirationAlert[] {
    if (!this.notificationConfig.minSeverity) {
      return alerts
    }

    const severityOrder: { [key in AlertSeverity]: number } = {
      critical: 0,
      warning: 1,
      info: 2,
    }

    const minLevel = severityOrder[this.notificationConfig.minSeverity]

    return alerts.filter((alert) => {
      return severityOrder[alert.severity] <= minLevel
    })
  }

  /**
   * Apply renotification throttling to prevent alert fatigue
   *
   * @param alerts - Alerts to potentially send
   * @returns Alerts that should be sent based on throttling rules
   */
  private applyRenotificationThrottling(
    alerts: ExpirationAlert[]
  ): ExpirationAlert[] {
    if (!this.notificationConfig.renotifyInterval) {
      return alerts
    }

    const now = new Date()
    const intervalMs = this.notificationConfig.renotifyInterval * 60 * 1000

    return alerts.filter((alert) => {
      const lastNotification = this.lastNotificationTimes.get(alert.keyName)

      if (!lastNotification) {
        return true // Never notified, send it
      }

      const timeSinceLastNotification = now.getTime() - lastNotification.getTime()

      // Always send critical alerts regardless of interval
      if (alert.severity === 'critical') {
        return true
      }

      // For warning and info, respect the interval
      return timeSinceLastNotification >= intervalMs
    })
  }
}
