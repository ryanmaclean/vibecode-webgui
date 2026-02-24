/**
 * Quality Alert Management System
 * Manages AI quality degradation alerts with persistence and DataDog metrics
 */

import { EventEmitter } from 'events'
import { PrismaClient, Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'
import { metrics } from '@/lib/server-monitoring'
import type { QualityDegradationAlert } from './quality-degradation-detector'

export interface QualityAlertRecord {
  id: number
  modelId: string
  alertType: 'acceptance_rate_drop' | 'edit_distance_increase' | 'rating_decline' | 'slow_acceptance'
  severity: 'warning' | 'critical'
  message: string
  threshold: number
  currentValue: number
  previousValue: number
  detectedAt: Date
  resolvedAt: Date | null
  resolved: boolean
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

export interface AlertStats {
  totalAlerts: number
  activeAlerts: number
  resolvedAlerts: number
  criticalAlerts: number
  warningAlerts: number
  alertsByType: Record<string, number>
  alertsByModel: Record<string, number>
}

/**
 * Quality Alert Manager
 * Handles creation, resolution, and querying of quality degradation alerts
 */
export class QualityAlertManager extends EventEmitter {
  private prisma: PrismaClient
  private alertCache: Map<number, QualityAlertRecord> = new Map()

  constructor(prisma: PrismaClient) {
    super()
    this.prisma = prisma

    logger.info('[QualityAlertManager] Initialized')
  }

  /**
   * Create a new quality alert from a degradation alert
   */
  public async createAlert(alert: QualityDegradationAlert): Promise<QualityAlertRecord> {
    logger.info('[QualityAlertManager] Creating alert', {
      modelId: alert.modelId,
      alertType: alert.alertType,
      severity: alert.severity,
    })

    try {
      // Check if a similar unresolved alert already exists
      const existingAlert = await this.prisma.aIQualityAlert.findFirst({
        where: {
          model_id: alert.modelId,
          alert_type: alert.alertType,
          resolved: false,
        },
        orderBy: {
          detected_at: 'desc',
        },
      })

      // If an unresolved alert exists for this model/type, update it instead of creating a new one
      if (existingAlert) {
        logger.info('[QualityAlertManager] Updating existing alert', {
          alertId: existingAlert.id,
          modelId: alert.modelId,
          alertType: alert.alertType,
        })

        const updated = await this.prisma.aIQualityAlert.update({
          where: {
            id: existingAlert.id,
          },
          data: {
            severity: alert.severity,
            message: alert.message,
            threshold: alert.threshold,
            current_value: alert.currentValue,
            previous_value: alert.previousValue,
            metadata: alert.metadata ? (alert.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
            updated_at: new Date(),
          },
        })

        const record = this.mapToAlertRecord(updated)
        this.alertCache.set(record.id, record)

        // Emit metrics
        this.emitAlertMetrics('updated', alert)

        // Emit event
        this.emit('alertUpdated', record)

        return record
      }

      // Create new alert
      const created = await this.prisma.aIQualityAlert.create({
        data: {
          model_id: alert.modelId,
          alert_type: alert.alertType,
          severity: alert.severity,
          message: alert.message,
          threshold: alert.threshold,
          current_value: alert.currentValue,
          previous_value: alert.previousValue,
          detected_at: new Date(alert.detectedAt),
          resolved: false,
          metadata: alert.metadata ? (alert.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      })

      const record = this.mapToAlertRecord(created)
      this.alertCache.set(record.id, record)

      // Emit metrics
      this.emitAlertMetrics('created', alert)

      // Emit event
      this.emit('alertCreated', record)

      logger.info('[QualityAlertManager] Alert created', {
        alertId: record.id,
        modelId: alert.modelId,
        alertType: alert.alertType,
      })

      return record
    } catch (error) {
      logger.error('[QualityAlertManager] Failed to create alert', {
        error,
        modelId: alert.modelId,
        alertType: alert.alertType,
      })

      // Emit error metric
      metrics.increment('ai.quality.alert.error', {
        service: 'vibecode-webgui',
        model_id: alert.modelId,
        alert_type: alert.alertType,
        operation: 'create',
      })

      throw error
    }
  }

  /**
   * Resolve an alert by ID
   */
  public async resolveAlert(alertId: number, resolutionNote?: string): Promise<QualityAlertRecord> {
    logger.info('[QualityAlertManager] Resolving alert', {
      alertId,
      resolutionNote,
    })

    try {
      const alert = await this.prisma.aIQualityAlert.findUnique({
        where: { id: alertId },
      })

      if (!alert) {
        throw new Error(`Alert ${alertId} not found`)
      }

      if (alert.resolved) {
        logger.warn('[QualityAlertManager] Alert already resolved', {
          alertId,
        })
      }

      const metadata = alert.metadata as Record<string, unknown> | null
      const updated = await this.prisma.aIQualityAlert.update({
        where: { id: alertId },
        data: {
          resolved: true,
          resolved_at: new Date(),
          metadata: resolutionNote
            ? ({
                ...(metadata || {}),
                resolutionNote,
              } as Prisma.InputJsonValue)
            : metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
          updated_at: new Date(),
        },
      })

      const record = this.mapToAlertRecord(updated)
      this.alertCache.delete(alertId)

      // Emit metrics
      metrics.increment('ai.quality.alert.resolved', {
        service: 'vibecode-webgui',
        model_id: record.modelId,
        alert_type: record.alertType,
        severity: record.severity,
      })

      // Calculate alert duration
      const durationMs = record.resolvedAt
        ? record.resolvedAt.getTime() - record.detectedAt.getTime()
        : 0

      metrics.histogram('ai.quality.alert.duration', durationMs, {
        service: 'vibecode-webgui',
        model_id: record.modelId,
        alert_type: record.alertType,
        severity: record.severity,
      })

      // Emit event
      this.emit('alertResolved', record)

      logger.info('[QualityAlertManager] Alert resolved', {
        alertId,
        durationMs,
      })

      return record
    } catch (error) {
      logger.error('[QualityAlertManager] Failed to resolve alert', {
        error,
        alertId,
      })

      metrics.increment('ai.quality.alert.error', {
        service: 'vibecode-webgui',
        operation: 'resolve',
      })

      throw error
    }
  }

  /**
   * Resolve all alerts for a specific model
   */
  public async resolveModelAlerts(modelId: string, resolutionNote?: string): Promise<number> {
    logger.info('[QualityAlertManager] Resolving all alerts for model', {
      modelId,
    })

    try {
      const result = await this.prisma.aIQualityAlert.updateMany({
        where: {
          model_id: modelId,
          resolved: false,
        },
        data: {
          resolved: true,
          resolved_at: new Date(),
          updated_at: new Date(),
        },
      })

      logger.info('[QualityAlertManager] Model alerts resolved', {
        modelId,
        count: result.count,
      })

      // Clear cache for this model
      for (const [key, record] of this.alertCache.entries()) {
        if (record.modelId === modelId) {
          this.alertCache.delete(key)
        }
      }

      // Emit metric
      metrics.increment('ai.quality.alert.bulk_resolved', {
        service: 'vibecode-webgui',
        model_id: modelId,
        count: result.count.toString(),
      })

      return result.count
    } catch (error) {
      logger.error('[QualityAlertManager] Failed to resolve model alerts', {
        error,
        modelId,
      })

      throw error
    }
  }

  /**
   * Get active (unresolved) alerts
   */
  public async getActiveAlerts(options?: {
    modelId?: string
    alertType?: string
    severity?: string
    limit?: number
  }): Promise<QualityAlertRecord[]> {
    try {
      const where: any = {
        resolved: false,
      }

      if (options?.modelId) {
        where.model_id = options.modelId
      }

      if (options?.alertType) {
        where.alert_type = options.alertType
      }

      if (options?.severity) {
        where.severity = options.severity
      }

      const alerts = await this.prisma.aIQualityAlert.findMany({
        where,
        orderBy: {
          detected_at: 'desc',
        },
        take: options?.limit,
      })

      return alerts.map(alert => this.mapToAlertRecord(alert))
    } catch (error) {
      logger.error('[QualityAlertManager] Failed to get active alerts', {
        error,
        options,
      })

      throw error
    }
  }

  /**
   * Get alert history
   */
  public async getAlertHistory(options?: {
    modelId?: string
    alertType?: string
    severity?: string
    startDate?: Date
    endDate?: Date
    includeResolved?: boolean
    limit?: number
    offset?: number
  }): Promise<QualityAlertRecord[]> {
    try {
      const where: any = {}

      if (options?.modelId) {
        where.model_id = options.modelId
      }

      if (options?.alertType) {
        where.alert_type = options.alertType
      }

      if (options?.severity) {
        where.severity = options.severity
      }

      if (options?.includeResolved === false) {
        where.resolved = false
      }

      if (options?.startDate || options?.endDate) {
        where.detected_at = {}
        if (options.startDate) {
          where.detected_at.gte = options.startDate
        }
        if (options.endDate) {
          where.detected_at.lte = options.endDate
        }
      }

      const alerts = await this.prisma.aIQualityAlert.findMany({
        where,
        orderBy: {
          detected_at: 'desc',
        },
        take: options?.limit,
        skip: options?.offset,
      })

      return alerts.map(alert => this.mapToAlertRecord(alert))
    } catch (error) {
      logger.error('[QualityAlertManager] Failed to get alert history', {
        error,
        options,
      })

      throw error
    }
  }

  /**
   * Get alert statistics
   */
  public async getAlertStats(options?: {
    modelId?: string
    startDate?: Date
    endDate?: Date
  }): Promise<AlertStats> {
    try {
      const where: any = {}

      if (options?.modelId) {
        where.model_id = options.modelId
      }

      if (options?.startDate || options?.endDate) {
        where.detected_at = {}
        if (options.startDate) {
          where.detected_at.gte = options.startDate
        }
        if (options.endDate) {
          where.detected_at.lte = options.endDate
        }
      }

      const alerts = await this.prisma.aIQualityAlert.findMany({
        where,
        select: {
          id: true,
          model_id: true,
          alert_type: true,
          severity: true,
          resolved: true,
        },
      })

      const stats: AlertStats = {
        totalAlerts: alerts.length,
        activeAlerts: alerts.filter(a => !a.resolved).length,
        resolvedAlerts: alerts.filter(a => a.resolved).length,
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
        warningAlerts: alerts.filter(a => a.severity === 'warning').length,
        alertsByType: {},
        alertsByModel: {},
      }

      // Count by type
      for (const alert of alerts) {
        stats.alertsByType[alert.alert_type] = (stats.alertsByType[alert.alert_type] || 0) + 1
        stats.alertsByModel[alert.model_id] = (stats.alertsByModel[alert.model_id] || 0) + 1
      }

      return stats
    } catch (error) {
      logger.error('[QualityAlertManager] Failed to get alert stats', {
        error,
        options,
      })

      throw error
    }
  }

  /**
   * Map database record to QualityAlertRecord
   */
  private mapToAlertRecord(dbAlert: any): QualityAlertRecord {
    return {
      id: dbAlert.id,
      modelId: dbAlert.model_id,
      alertType: dbAlert.alert_type as QualityAlertRecord['alertType'],
      severity: dbAlert.severity as QualityAlertRecord['severity'],
      message: dbAlert.message,
      threshold: dbAlert.threshold,
      currentValue: dbAlert.current_value,
      previousValue: dbAlert.previous_value,
      detectedAt: dbAlert.detected_at,
      resolvedAt: dbAlert.resolved_at,
      resolved: dbAlert.resolved,
      metadata: dbAlert.metadata as Record<string, unknown> | null,
      createdAt: dbAlert.created_at,
      updatedAt: dbAlert.updated_at,
    }
  }

  /**
   * Emit DataDog metrics for alert operations
   */
  private emitAlertMetrics(operation: 'created' | 'updated', alert: QualityDegradationAlert): void {
    try {
      // Increment alert counter
      metrics.increment(`ai.quality.alert.${operation}`, {
        service: 'vibecode-webgui',
        model_id: alert.modelId,
        alert_type: alert.alertType,
        severity: alert.severity,
      })

      // Track alert value metrics
      metrics.gauge('ai.quality.alert.current_value', alert.currentValue, {
        service: 'vibecode-webgui',
        model_id: alert.modelId,
        alert_type: alert.alertType,
      })

      metrics.gauge('ai.quality.alert.threshold', alert.threshold, {
        service: 'vibecode-webgui',
        model_id: alert.modelId,
        alert_type: alert.alertType,
      })

      // Calculate deviation from threshold
      const deviation = Math.abs(alert.currentValue - alert.threshold)
      metrics.gauge('ai.quality.alert.deviation', deviation, {
        service: 'vibecode-webgui',
        model_id: alert.modelId,
        alert_type: alert.alertType,
      })
    } catch (error) {
      logger.warn('[QualityAlertManager] Failed to emit metrics', {
        error,
        operation,
        alert,
      })
    }
  }

  /**
   * Clear the alert cache
   */
  public clearCache(): void {
    this.alertCache.clear()
    logger.info('[QualityAlertManager] Cache cleared')
  }

  /**
   * Shutdown the alert manager
   */
  public shutdown(): void {
    this.clearCache()
    this.removeAllListeners()
    logger.info('[QualityAlertManager] Shutdown complete')
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let globalAlertManager: QualityAlertManager | null = null

/**
 * Get the global quality alert manager instance
 */
export function getQualityAlertManager(prisma?: PrismaClient): QualityAlertManager {
  if (!globalAlertManager) {
    if (!prisma) {
      throw new Error('Prisma client required to initialize QualityAlertManager')
    }
    globalAlertManager = new QualityAlertManager(prisma)
  }
  return globalAlertManager
}

/**
 * Create a new quality alert manager instance
 */
export function createQualityAlertManager(prisma: PrismaClient): QualityAlertManager {
  return new QualityAlertManager(prisma)
}

/**
 * Reset the global alert manager (mainly for testing)
 */
export function resetQualityAlertManager(): void {
  if (globalAlertManager) {
    globalAlertManager.shutdown()
    globalAlertManager = null
  }
}
