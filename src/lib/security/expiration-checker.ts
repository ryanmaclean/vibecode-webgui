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
 * ExpirationChecker class - Monitors and alerts on secret expiration
 */
export class ExpirationChecker {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
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

      // Determine status and severity
      let status: ExpirationStatus['status']
      let severity: AlertSeverity | null = null
      let message: string

      if (daysUntilExpiration < 0) {
        status = 'expired'
        severity = 'critical'
        message = `Secret expired ${Math.abs(daysUntilExpiration)} days ago`
      } else if (daysUntilExpiration <= 1) {
        status = 'expiring_soon'
        severity = 'critical'
        message = `Secret expires in ${daysUntilExpiration} day(s) - immediate action required`
      } else if (daysUntilExpiration <= 7) {
        status = 'expiring_soon'
        severity = 'critical'
        message = `Secret expires in ${daysUntilExpiration} days - rotation needed urgently`
      } else if (daysUntilExpiration <= 14) {
        status = 'expiring_soon'
        severity = 'warning'
        message = `Secret expires in ${daysUntilExpiration} days - plan rotation soon`
      } else if (daysUntilExpiration <= thresholdDays) {
        status = 'expiring_soon'
        severity = 'info'
        message = `Secret expires in ${daysUntilExpiration} days - rotation recommended`
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
      // Get summary with all alerts
      const summary = await this.getSummary(options)
      const { alerts } = summary

      if (alerts.length === 0) {
        logger.info('No expiration alerts to send')
        return []
      }

      // Log alerts with appropriate severity
      for (const alert of alerts) {
        const metadata = {
          keyName: alert.keyName,
          expiresAt: alert.expiresAt,
          daysUntilExpiration: alert.daysUntilExpiration,
          rotationPolicy: alert.rotationPolicy,
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
      }

      logger.info('Sent expiration alerts', {
        totalAlerts: alerts.length,
        critical: alerts.filter((a) => a.severity === 'critical').length,
        warning: alerts.filter((a) => a.severity === 'warning').length,
        info: alerts.filter((a) => a.severity === 'info').length,
      })

      return alerts
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
}
