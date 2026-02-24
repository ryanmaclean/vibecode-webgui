/**
 * Quality Degradation Detection System
 * Monitors AI model quality metrics and detects degradation trends
 */

import { EventEmitter } from 'events'
import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'
import type { TrendDirection } from '@/types/ai-quality-metrics'

export interface QualityDegradationAlert {
  id: string
  modelId: string
  alertType: 'acceptance_rate_drop' | 'edit_distance_increase' | 'rating_decline' | 'slow_acceptance'
  severity: 'warning' | 'critical'
  message: string
  threshold: number
  currentValue: number
  previousValue: number
  detectedAt: string
  metadata?: Record<string, unknown>
}

export interface DegradationCheckResult {
  modelId: string
  hasDegradation: boolean
  alerts: QualityDegradationAlert[]
  metrics: {
    acceptanceRate: number | null
    avgEditDistance: number | null
    avgRating: number | null
    avgTimeToAccept: number | null
  }
  trend: {
    direction: TrendDirection
    confidence: number
    slope: number
  }
}

export interface DegradationThresholds {
  // Acceptance rate thresholds
  acceptanceRateWarning: number // Warning if rate drops below this (e.g., 0.7 = 70%)
  acceptanceRateCritical: number // Critical if rate drops below this (e.g., 0.5 = 50%)
  acceptanceRateDropPercent: number // Alert if rate drops by this percentage (e.g., 20 = 20% drop)

  // Edit distance thresholds
  editDistanceWarning: number // Warning if edit distance exceeds this (e.g., 50)
  editDistanceCritical: number // Critical if edit distance exceeds this (e.g., 100)
  editDistanceIncreasePercent: number // Alert if edit distance increases by this percentage (e.g., 30 = 30% increase)

  // Rating thresholds
  ratingWarning: number // Warning if rating drops below this (e.g., 3.5 stars)
  ratingCritical: number // Critical if rating drops below this (e.g., 2.5 stars)
  ratingDropAmount: number // Alert if rating drops by this amount (e.g., 0.5 stars)

  // Time to accept thresholds
  timeToAcceptWarning: number // Warning if time exceeds this (e.g., 10000ms)
  timeToAcceptCritical: number // Critical if time exceeds this (e.g., 30000ms)
  timeToAcceptIncreasePercent: number // Alert if time increases by this percentage (e.g., 50 = 50% increase)

  // Trend analysis
  minDataPoints: number // Minimum data points required for trend analysis (e.g., 5)
  trendSignificanceThreshold: number // R-squared threshold for trend confidence (e.g., 0.7)
}

/**
 * Quality Degradation Detector
 * Analyzes quality metrics over time and detects degradation patterns
 */
export class QualityDegradationDetector extends EventEmitter {
  private prisma: PrismaClient
  private thresholds: DegradationThresholds
  private monitoringInterval?: NodeJS.Timeout
  private detectedAlerts: Map<string, QualityDegradationAlert> = new Map()

  // Default thresholds
  private static readonly DEFAULT_THRESHOLDS: DegradationThresholds = {
    acceptanceRateWarning: 0.7,
    acceptanceRateCritical: 0.5,
    acceptanceRateDropPercent: 20,
    editDistanceWarning: 50,
    editDistanceCritical: 100,
    editDistanceIncreasePercent: 30,
    ratingWarning: 3.5,
    ratingCritical: 2.5,
    ratingDropAmount: 0.5,
    timeToAcceptWarning: 10000,
    timeToAcceptCritical: 30000,
    timeToAcceptIncreasePercent: 50,
    minDataPoints: 5,
    trendSignificanceThreshold: 0.7,
  }

  constructor(prisma: PrismaClient, thresholds?: Partial<DegradationThresholds>) {
    super()
    this.prisma = prisma
    this.thresholds = {
      ...QualityDegradationDetector.DEFAULT_THRESHOLDS,
      ...thresholds,
    }

    logger.info('[QualityDegradationDetector] Initialized', {
      thresholds: this.thresholds,
    })
  }

  /**
   * Start periodic monitoring
   */
  public startMonitoring(intervalMs: number = 300000): void {
    if (this.monitoringInterval) {
      logger.warn('[QualityDegradationDetector] Monitoring already started')
      return
    }

    logger.info('[QualityDegradationDetector] Starting monitoring', {
      intervalMs,
    })

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkAllModels()
      } catch (error) {
        logger.error('[QualityDegradationDetector] Error during periodic check', {
          error,
        })
      }
    }, intervalMs)
  }

  /**
   * Stop periodic monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
      logger.info('[QualityDegradationDetector] Monitoring stopped')
    }
  }

  /**
   * Check all models for degradation
   */
  public async checkAllModels(): Promise<DegradationCheckResult[]> {
    logger.info('[QualityDegradationDetector] Checking all models for degradation')

    // Get all unique model IDs from recent metrics
    const models = await this.prisma.aIQualityMetric.findMany({
      select: {
        model_id: true,
      },
      distinct: ['model_id'],
      orderBy: {
        created_at: 'desc',
      },
    })

    const results: DegradationCheckResult[] = []

    for (const { model_id } of models) {
      try {
        const result = await this.checkForDegradation(model_id)
        results.push(result)

        if (result.hasDegradation) {
          logger.warn('[QualityDegradationDetector] Degradation detected', {
            modelId: model_id,
            alertCount: result.alerts.length,
          })

          // Emit alerts
          for (const alert of result.alerts) {
            this.emit('degradationDetected', alert)
          }
        }
      } catch (error) {
        logger.error('[QualityDegradationDetector] Error checking model', {
          modelId: model_id,
          error,
        })
      }
    }

    return results
  }

  /**
   * Check for quality degradation in a specific model
   */
  public async checkForDegradation(modelId: string): Promise<DegradationCheckResult> {
    logger.info('[QualityDegradationDetector] Checking model for degradation', {
      modelId,
    })

    // Get recent metrics (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const metrics = await this.prisma.aIQualityMetric.findMany({
      where: {
        model_id: modelId,
        start_date: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: {
        start_date: 'asc',
      },
    })

    if (metrics.length === 0) {
      logger.warn('[QualityDegradationDetector] No metrics found for model', {
        modelId,
      })

      return {
        modelId,
        hasDegradation: false,
        alerts: [],
        metrics: {
          acceptanceRate: null,
          avgEditDistance: null,
          avgRating: null,
          avgTimeToAccept: null,
        },
        trend: {
          direction: 'stable',
          confidence: 0,
          slope: 0,
        },
      }
    }

    // Get current (most recent) metrics
    const currentMetric = metrics[metrics.length - 1]

    // Calculate trend
    const trend = this.calculateTrend(
      metrics.map(m => ({
        timestamp: m.start_date,
        value: m.acceptance_rate ?? 0,
      }))
    )

    // Detect various types of degradation
    const alerts: QualityDegradationAlert[] = []

    // Check acceptance rate
    if (metrics.length >= 2) {
      const acceptanceRateAlerts = this.detectAcceptanceRateDrop(
        modelId,
        metrics[metrics.length - 2],
        currentMetric
      )
      alerts.push(...acceptanceRateAlerts)
    }

    // Check edit distance
    if (metrics.length >= 2) {
      const editDistanceAlerts = this.detectEditDistanceIncrease(
        modelId,
        metrics[metrics.length - 2],
        currentMetric
      )
      alerts.push(...editDistanceAlerts)
    }

    // Check rating
    if (metrics.length >= 2) {
      const ratingAlerts = this.detectRatingDecline(
        modelId,
        metrics[metrics.length - 2],
        currentMetric
      )
      alerts.push(...ratingAlerts)
    }

    // Check time to accept
    if (metrics.length >= 2) {
      const timeToAcceptAlerts = this.detectSlowAcceptance(
        modelId,
        metrics[metrics.length - 2],
        currentMetric
      )
      alerts.push(...timeToAcceptAlerts)
    }

    // Store alerts in memory
    for (const alert of alerts) {
      this.detectedAlerts.set(alert.id, alert)
    }

    return {
      modelId,
      hasDegradation: alerts.length > 0,
      alerts,
      metrics: {
        acceptanceRate: currentMetric.acceptance_rate,
        avgEditDistance: currentMetric.avg_edit_distance,
        avgRating: currentMetric.avg_rating,
        avgTimeToAccept: currentMetric.avg_time_to_accept,
      },
      trend,
    }
  }

  /**
   * Detect acceptance rate drops
   */
  private detectAcceptanceRateDrop(
    modelId: string,
    previousMetric: any,
    currentMetric: any
  ): QualityDegradationAlert[] {
    const alerts: QualityDegradationAlert[] = []

    const currentRate = currentMetric.acceptance_rate
    const previousRate = previousMetric.acceptance_rate

    if (currentRate === null || previousRate === null) {
      return alerts
    }

    // Check absolute thresholds
    if (currentRate < this.thresholds.acceptanceRateCritical) {
      alerts.push(this.createAlert(
        modelId,
        'acceptance_rate_drop',
        'critical',
        `Acceptance rate critically low: ${(currentRate * 100).toFixed(1)}%`,
        this.thresholds.acceptanceRateCritical,
        currentRate,
        previousRate
      ))
    } else if (currentRate < this.thresholds.acceptanceRateWarning) {
      alerts.push(this.createAlert(
        modelId,
        'acceptance_rate_drop',
        'warning',
        `Acceptance rate below warning threshold: ${(currentRate * 100).toFixed(1)}%`,
        this.thresholds.acceptanceRateWarning,
        currentRate,
        previousRate
      ))
    }

    // Check percentage drop
    if (previousRate > 0) {
      const percentDrop = ((previousRate - currentRate) / previousRate) * 100

      if (percentDrop >= this.thresholds.acceptanceRateDropPercent) {
        alerts.push(this.createAlert(
          modelId,
          'acceptance_rate_drop',
          percentDrop >= this.thresholds.acceptanceRateDropPercent * 1.5 ? 'critical' : 'warning',
          `Acceptance rate dropped by ${percentDrop.toFixed(1)}%`,
          previousRate,
          currentRate,
          previousRate,
          {
            percentDrop,
          }
        ))
      }
    }

    return alerts
  }

  /**
   * Detect edit distance increases
   */
  private detectEditDistanceIncrease(
    modelId: string,
    previousMetric: any,
    currentMetric: any
  ): QualityDegradationAlert[] {
    const alerts: QualityDegradationAlert[] = []

    const currentDistance = currentMetric.avg_edit_distance
    const previousDistance = previousMetric.avg_edit_distance

    if (currentDistance === null || previousDistance === null) {
      return alerts
    }

    // Check absolute thresholds
    if (currentDistance > this.thresholds.editDistanceCritical) {
      alerts.push(this.createAlert(
        modelId,
        'edit_distance_increase',
        'critical',
        `Edit distance critically high: ${currentDistance.toFixed(1)}`,
        this.thresholds.editDistanceCritical,
        currentDistance,
        previousDistance
      ))
    } else if (currentDistance > this.thresholds.editDistanceWarning) {
      alerts.push(this.createAlert(
        modelId,
        'edit_distance_increase',
        'warning',
        `Edit distance above warning threshold: ${currentDistance.toFixed(1)}`,
        this.thresholds.editDistanceWarning,
        currentDistance,
        previousDistance
      ))
    }

    // Check percentage increase
    if (previousDistance > 0) {
      const percentIncrease = ((currentDistance - previousDistance) / previousDistance) * 100

      if (percentIncrease >= this.thresholds.editDistanceIncreasePercent) {
        alerts.push(this.createAlert(
          modelId,
          'edit_distance_increase',
          percentIncrease >= this.thresholds.editDistanceIncreasePercent * 1.5 ? 'critical' : 'warning',
          `Edit distance increased by ${percentIncrease.toFixed(1)}%`,
          previousDistance,
          currentDistance,
          previousDistance,
          {
            percentIncrease,
          }
        ))
      }
    }

    return alerts
  }

  /**
   * Detect rating declines
   */
  private detectRatingDecline(
    modelId: string,
    previousMetric: any,
    currentMetric: any
  ): QualityDegradationAlert[] {
    const alerts: QualityDegradationAlert[] = []

    const currentRating = currentMetric.avg_rating
    const previousRating = previousMetric.avg_rating

    if (currentRating === null || previousRating === null) {
      return alerts
    }

    // Check absolute thresholds
    if (currentRating < this.thresholds.ratingCritical) {
      alerts.push(this.createAlert(
        modelId,
        'rating_decline',
        'critical',
        `Rating critically low: ${currentRating.toFixed(1)}/5`,
        this.thresholds.ratingCritical,
        currentRating,
        previousRating
      ))
    } else if (currentRating < this.thresholds.ratingWarning) {
      alerts.push(this.createAlert(
        modelId,
        'rating_decline',
        'warning',
        `Rating below warning threshold: ${currentRating.toFixed(1)}/5`,
        this.thresholds.ratingWarning,
        currentRating,
        previousRating
      ))
    }

    // Check rating drop amount
    const ratingDrop = previousRating - currentRating

    if (ratingDrop >= this.thresholds.ratingDropAmount) {
      alerts.push(this.createAlert(
        modelId,
        'rating_decline',
        ratingDrop >= this.thresholds.ratingDropAmount * 2 ? 'critical' : 'warning',
        `Rating dropped by ${ratingDrop.toFixed(1)} stars`,
        previousRating,
        currentRating,
        previousRating,
        {
          ratingDrop,
        }
      ))
    }

    return alerts
  }

  /**
   * Detect slow acceptance times
   */
  private detectSlowAcceptance(
    modelId: string,
    previousMetric: any,
    currentMetric: any
  ): QualityDegradationAlert[] {
    const alerts: QualityDegradationAlert[] = []

    const currentTime = currentMetric.avg_time_to_accept
    const previousTime = previousMetric.avg_time_to_accept

    if (currentTime === null || previousTime === null) {
      return alerts
    }

    // Check absolute thresholds
    if (currentTime > this.thresholds.timeToAcceptCritical) {
      alerts.push(this.createAlert(
        modelId,
        'slow_acceptance',
        'critical',
        `Time to accept critically slow: ${(currentTime / 1000).toFixed(1)}s`,
        this.thresholds.timeToAcceptCritical,
        currentTime,
        previousTime
      ))
    } else if (currentTime > this.thresholds.timeToAcceptWarning) {
      alerts.push(this.createAlert(
        modelId,
        'slow_acceptance',
        'warning',
        `Time to accept above warning threshold: ${(currentTime / 1000).toFixed(1)}s`,
        this.thresholds.timeToAcceptWarning,
        currentTime,
        previousTime
      ))
    }

    // Check percentage increase
    if (previousTime > 0) {
      const percentIncrease = ((currentTime - previousTime) / previousTime) * 100

      if (percentIncrease >= this.thresholds.timeToAcceptIncreasePercent) {
        alerts.push(this.createAlert(
          modelId,
          'slow_acceptance',
          percentIncrease >= this.thresholds.timeToAcceptIncreasePercent * 1.5 ? 'critical' : 'warning',
          `Time to accept increased by ${percentIncrease.toFixed(1)}%`,
          previousTime,
          currentTime,
          previousTime,
          {
            percentIncrease,
          }
        ))
      }
    }

    return alerts
  }

  /**
   * Calculate trend direction and confidence from time series data
   */
  private calculateTrend(dataPoints: Array<{ timestamp: Date; value: number }>): {
    direction: TrendDirection
    confidence: number
    slope: number
  } {
    if (dataPoints.length < this.thresholds.minDataPoints) {
      return { direction: 'stable', confidence: 0, slope: 0 }
    }

    // Simple linear regression
    const n = dataPoints.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = dataPoints.map(d => d.value)

    const xMean = x.reduce((sum, val) => sum + val, 0) / n
    const yMean = y.reduce((sum, val) => sum + val, 0) / n

    let numerator = 0
    let denominator = 0

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean)
      denominator += (x[i] - xMean) ** 2
    }

    const slope = denominator === 0 ? 0 : numerator / denominator

    // Calculate R-squared for confidence
    const yPredicted = x.map(xi => yMean + slope * (xi - xMean))
    const ssResidual = y.reduce((sum, yi, i) => sum + (yi - yPredicted[i]) ** 2, 0)
    const ssTotal = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0)
    const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal

    // Determine trend direction
    const threshold = 0.01 // 1% change threshold
    let direction: TrendDirection
    if (Math.abs(slope) < threshold) {
      direction = 'stable'
    } else if (slope > 0) {
      direction = 'improving'
    } else {
      direction = 'declining'
    }

    return {
      direction,
      confidence: Math.max(0, Math.min(1, rSquared)),
      slope,
    }
  }

  /**
   * Create an alert object
   */
  private createAlert(
    modelId: string,
    alertType: QualityDegradationAlert['alertType'],
    severity: QualityDegradationAlert['severity'],
    message: string,
    threshold: number,
    currentValue: number,
    previousValue: number,
    metadata?: Record<string, unknown>
  ): QualityDegradationAlert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      modelId,
      alertType,
      severity,
      message,
      threshold,
      currentValue,
      previousValue,
      detectedAt: new Date().toISOString(),
      metadata,
    }
  }

  /**
   * Get all detected alerts
   */
  public getDetectedAlerts(): QualityDegradationAlert[] {
    return Array.from(this.detectedAlerts.values())
  }

  /**
   * Clear detected alerts
   */
  public clearDetectedAlerts(): void {
    this.detectedAlerts.clear()
  }

  /**
   * Shutdown the detector
   */
  public shutdown(): void {
    this.stopMonitoring()
    this.detectedAlerts.clear()
    this.removeAllListeners()
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let globalDetector: QualityDegradationDetector | null = null

/**
 * Get the global quality degradation detector instance
 */
export function getQualityDegradationDetector(
  prisma?: PrismaClient,
  thresholds?: Partial<DegradationThresholds>
): QualityDegradationDetector {
  if (!globalDetector) {
    if (!prisma) {
      throw new Error('Prisma client required to initialize QualityDegradationDetector')
    }
    globalDetector = new QualityDegradationDetector(prisma, thresholds)
  }
  return globalDetector
}

/**
 * Create a new quality degradation detector instance
 */
export function createQualityDegradationDetector(
  prisma: PrismaClient,
  thresholds?: Partial<DegradationThresholds>
): QualityDegradationDetector {
  return new QualityDegradationDetector(prisma, thresholds)
}

/**
 * Reset the global detector (mainly for testing)
 */
export function resetQualityDegradationDetector(): void {
  if (globalDetector) {
    globalDetector.shutdown()
    globalDetector = null
  }
}
