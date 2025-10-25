/**
 * Experiment Analytics Query Builders
 *
 * SQL query builders and data analysis utilities for experiment results.
 * Provides statistical analysis, time series, and cohort analysis capabilities.
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { logger } from '@/lib/server-monitoring'

const prisma = new PrismaClient()

/**
 * Variant distribution data
 */
export interface VariantDistribution {
  variantKey: string
  count: number
  percentage: number
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: Date
  variantKey: string
  metricName: string
  value: number
  count: number
  average: number
}

/**
 * Retention cohort data
 */
export interface RetentionCohort {
  variantKey: string
  cohortDate: Date
  day0: number
  day1: number
  day7: number
  day14: number
  day30: number
}

/**
 * Sample ratio check result
 */
export interface SampleRatioCheck {
  expectedRatio: Record<string, number>
  observedRatio: Record<string, number>
  pValue: number
  isPassing: boolean
  chiSquare: number
}

/**
 * Metric aggregation by variant
 */
export interface MetricAggregation {
  variantKey: string
  metricName: string
  count: number
  sum: number
  mean: number
  median: number
  p50: number
  p95: number
  p99: number
  min: number
  max: number
  stdDev: number
}

/**
 * Query builder for experiment analytics
 */
export class ExperimentQueries {
  /**
   * Get variant distribution for an experiment
   *
   * Returns the count and percentage of users assigned to each variant.
   *
   * @param experimentKey - Unique experiment identifier
   * @returns Variant distribution data
   */
  async getVariantDistribution(experimentKey: string): Promise<VariantDistribution[]> {
    try {
      const experiment = await prisma.experiment.findUnique({
        where: { key: experimentKey },
        include: {
          assignments: {
            select: { variant_key: true }
          }
        }
      })

      if (!experiment) {
        return []
      }

      // Count assignments per variant
      const variantCounts = new Map<string, number>()
      for (const assignment of experiment.assignments) {
        const count = variantCounts.get(assignment.variant_key) || 0
        variantCounts.set(assignment.variant_key, count + 1)
      }

      const total = experiment.assignments.length
      const distribution: VariantDistribution[] = []

      for (const [variantKey, count] of variantCounts) {
        distribution.push({
          variantKey,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0
        })
      }

      return distribution.sort((a, b) => b.count - a.count)

    } catch (error) {
      logger.error('Failed to get variant distribution', {
        experimentKey,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Get metric aggregation by variant
   *
   * Calculates statistical aggregates (mean, median, percentiles) for metrics
   * grouped by variant.
   *
   * @param experimentKey - Unique experiment identifier
   * @param metricName - Metric name to aggregate
   * @returns Metric aggregations per variant
   */
  async getMetricAggregation(
    experimentKey: string,
    metricName: string
  ): Promise<MetricAggregation[]> {
    try {
      const experiment = await prisma.experiment.findUnique({
        where: { key: experimentKey },
        include: {
          metrics: {
            where: { metric_name: metricName },
            select: {
              variant_key: true,
              value: true
            }
          }
        }
      })

      if (!experiment) {
        return []
      }

      // Group metrics by variant
      const metricsByVariant = new Map<string, number[]>()
      for (const metric of experiment.metrics) {
        if (!metricsByVariant.has(metric.variant_key)) {
          metricsByVariant.set(metric.variant_key, [])
        }
        metricsByVariant.get(metric.variant_key)!.push(metric.value)
      }

      // Calculate aggregations
      const aggregations: MetricAggregation[] = []

      for (const [variantKey, values] of metricsByVariant) {
        const sorted = [...values].sort((a, b) => a - b)
        const count = sorted.length
        const sum = sorted.reduce((acc, v) => acc + v, 0)
        const mean = count > 0 ? sum / count : 0

        // Variance and std dev
        const variance = count > 0
          ? sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count
          : 0
        const stdDev = Math.sqrt(variance)

        // Percentile helper
        const percentile = (p: number) => {
          if (count === 0) return 0
          const index = Math.ceil((p / 100) * count) - 1
          return sorted[Math.max(0, Math.min(index, count - 1))]
        }

        aggregations.push({
          variantKey,
          metricName,
          count,
          sum,
          mean,
          median: percentile(50),
          p50: percentile(50),
          p95: percentile(95),
          p99: percentile(99),
          min: count > 0 ? sorted[0] : 0,
          max: count > 0 ? sorted[count - 1] : 0,
          stdDev
        })
      }

      return aggregations.sort((a, b) => a.variantKey.localeCompare(b.variantKey))

    } catch (error) {
      logger.error('Failed to get metric aggregation', {
        experimentKey,
        metricName,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Get time series data for metrics
   *
   * Returns metrics aggregated over time intervals (hourly, daily, etc.)
   * to show trends and patterns.
   *
   * @param experimentKey - Unique experiment identifier
   * @param metricName - Metric name
   * @param interval - Time interval ('hour', 'day', 'week')
   * @param startDate - Optional start date
   * @param endDate - Optional end date
   * @returns Time series data points
   */
  async getTimeSeriesData(
    experimentKey: string,
    metricName: string,
    interval: 'hour' | 'day' | 'week' = 'day',
    startDate?: Date,
    endDate?: Date
  ): Promise<TimeSeriesPoint[]> {
    try {
      const experiment = await prisma.experiment.findUnique({
        where: { key: experimentKey },
        include: {
          metrics: {
            where: {
              metric_name: metricName,
              timestamp: {
                gte: startDate,
                lte: endDate
              }
            },
            select: {
              variant_key: true,
              value: true,
              timestamp: true
            },
            orderBy: { timestamp: 'asc' }
          }
        }
      })

      if (!experiment) {
        return []
      }

      // Group by time bucket and variant
      const buckets = new Map<string, Map<string, { values: number[], timestamp: Date }>>()

      for (const metric of experiment.metrics) {
        const bucketKey = this.getBucketKey(metric.timestamp, interval)

        if (!buckets.has(bucketKey)) {
          buckets.set(bucketKey, new Map())
        }

        const variantBucket = buckets.get(bucketKey)!
        if (!variantBucket.has(metric.variant_key)) {
          variantBucket.set(metric.variant_key, {
            values: [],
            timestamp: this.getBucketDate(metric.timestamp, interval)
          })
        }

        variantBucket.get(metric.variant_key)!.values.push(metric.value)
      }

      // Convert to time series points
      const timeSeries: TimeSeriesPoint[] = []

      for (const [bucketKey, variants] of buckets) {
        for (const [variantKey, data] of variants) {
          const count = data.values.length
          const sum = data.values.reduce((acc, v) => acc + v, 0)
          const average = count > 0 ? sum / count : 0

          timeSeries.push({
            timestamp: data.timestamp,
            variantKey,
            metricName,
            value: sum,
            count,
            average
          })
        }
      }

      return timeSeries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    } catch (error) {
      logger.error('Failed to get time series data', {
        experimentKey,
        metricName,
        interval,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Calculate user retention by variant
   *
   * Analyzes user retention across different cohorts to identify
   * long-term impact of variants.
   *
   * @param experimentKey - Unique experiment identifier
   * @param metricName - Activity metric name (e.g., 'session_started')
   * @returns Retention cohort data
   */
  async getUserRetention(
    experimentKey: string,
    metricName: string = 'session_started'
  ): Promise<RetentionCohort[]> {
    try {
      const experiment = await prisma.experiment.findUnique({
        where: { key: experimentKey },
        include: {
          assignments: {
            select: {
              user_id: true,
              variant_key: true,
              timestamp: true
            }
          },
          metrics: {
            where: { metric_name: metricName },
            select: {
              user_id: true,
              timestamp: true
            }
          }
        }
      })

      if (!experiment) {
        return []
      }

      // Build user assignment map
      const userAssignments = new Map<string, { variantKey: string, cohortDate: Date }>()
      for (const assignment of experiment.assignments) {
        userAssignments.set(assignment.user_id, {
          variantKey: assignment.variant_key,
          cohortDate: this.getBucketDate(assignment.timestamp, 'day')
        })
      }

      // Build user activity map
      const userActivity = new Map<string, Date[]>()
      for (const metric of experiment.metrics) {
        if (!userActivity.has(metric.user_id)) {
          userActivity.set(metric.user_id, [])
        }
        userActivity.get(metric.user_id)!.push(metric.timestamp)
      }

      // Calculate retention by cohort and variant
      const cohortMap = new Map<string, RetentionCohort>()

      for (const [userId, assignment] of userAssignments) {
        const cohortKey = `${assignment.variantKey}_${assignment.cohortDate.toISOString()}`

        if (!cohortMap.has(cohortKey)) {
          cohortMap.set(cohortKey, {
            variantKey: assignment.variantKey,
            cohortDate: assignment.cohortDate,
            day0: 0,
            day1: 0,
            day7: 0,
            day14: 0,
            day30: 0
          })
        }

        const cohort = cohortMap.get(cohortKey)!
        const activities = userActivity.get(userId) || []

        // Count as day 0 (assigned)
        cohort.day0++

        // Check activity on specific days
        const cohortTime = assignment.cohortDate.getTime()
        const DAY_MS = 24 * 60 * 60 * 1000

        for (const activity of activities) {
          const daysSince = Math.floor((activity.getTime() - cohortTime) / DAY_MS)

          if (daysSince >= 1 && daysSince < 2) cohort.day1++
          if (daysSince >= 7 && daysSince < 8) cohort.day7++
          if (daysSince >= 14 && daysSince < 15) cohort.day14++
          if (daysSince >= 30 && daysSince < 31) cohort.day30++
        }
      }

      return Array.from(cohortMap.values()).sort(
        (a, b) => a.cohortDate.getTime() - b.cohortDate.getTime()
      )

    } catch (error) {
      logger.error('Failed to calculate user retention', {
        experimentKey,
        metricName,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Calculate sample ratio mismatch (SRM)
   *
   * Checks if the observed variant distribution matches the expected ratio.
   * Uses chi-square test to detect potential randomization issues.
   *
   * @param experimentKey - Unique experiment identifier
   * @param expectedRatio - Expected ratio per variant (e.g., { control: 0.5, treatment: 0.5 })
   * @returns Sample ratio check result
   */
  async calculateSampleRatio(
    experimentKey: string,
    expectedRatio: Record<string, number>
  ): Promise<SampleRatioCheck> {
    try {
      const distribution = await this.getVariantDistribution(experimentKey)

      if (distribution.length === 0) {
        return {
          expectedRatio,
          observedRatio: {},
          pValue: 1,
          isPassing: true,
          chiSquare: 0
        }
      }

      // Calculate observed ratio
      const total = distribution.reduce((sum, d) => sum + d.count, 0)
      const observedRatio: Record<string, number> = {}
      for (const d of distribution) {
        observedRatio[d.variantKey] = d.count / total
      }

      // Chi-square test
      let chiSquare = 0
      for (const variantKey of Object.keys(expectedRatio)) {
        const expected = expectedRatio[variantKey] * total
        const observed = distribution.find(d => d.variantKey === variantKey)?.count || 0

        if (expected > 0) {
          chiSquare += Math.pow(observed - expected, 2) / expected
        }
      }

      // Calculate p-value (approximation using chi-square distribution)
      // degrees of freedom = number of variants - 1
      const df = Object.keys(expectedRatio).length - 1
      const pValue = this.chiSquarePValue(chiSquare, df)

      // Pass if p-value > 0.05 (no significant mismatch)
      const isPassing = pValue > 0.05

      return {
        expectedRatio,
        observedRatio,
        pValue,
        isPassing,
        chiSquare
      }

    } catch (error) {
      logger.error('Failed to calculate sample ratio', {
        experimentKey,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Get experiment summary statistics
   *
   * Returns a comprehensive summary of experiment performance.
   *
   * @param experimentKey - Unique experiment identifier
   * @returns Summary statistics
   */
  async getExperimentSummary(experimentKey: string): Promise<{
    experiment: any
    totalAssignments: number
    totalMetrics: number
    variantDistribution: VariantDistribution[]
    uniqueMetrics: string[]
    dateRange: { start: Date | null, end: Date | null }
  }> {
    try {
      const experiment = await prisma.experiment.findUnique({
        where: { key: experimentKey },
        include: {
          assignments: {
            select: {
              timestamp: true,
              variant_key: true
            }
          },
          metrics: {
            select: {
              metric_name: true,
              timestamp: true
            }
          }
        }
      })

      if (!experiment) {
        throw new Error(`Experiment not found: ${experimentKey}`)
      }

      const variantDistribution = await this.getVariantDistribution(experimentKey)

      const uniqueMetrics = Array.from(
        new Set(experiment.metrics.map(m => m.metric_name))
      ).sort()

      const allTimestamps = [
        ...experiment.assignments.map(a => a.timestamp),
        ...experiment.metrics.map(m => m.timestamp)
      ]

      const dateRange = {
        start: allTimestamps.length > 0
          ? new Date(Math.min(...allTimestamps.map(t => t.getTime())))
          : null,
        end: allTimestamps.length > 0
          ? new Date(Math.max(...allTimestamps.map(t => t.getTime())))
          : null
      }

      return {
        experiment: {
          id: experiment.id,
          key: experiment.key,
          name: experiment.name,
          status: experiment.status,
          hypothesis: experiment.hypothesis,
          config: experiment.config,
          created_at: experiment.created_at,
          updated_at: experiment.updated_at
        },
        totalAssignments: experiment.assignments.length,
        totalMetrics: experiment.metrics.length,
        variantDistribution,
        uniqueMetrics,
        dateRange
      }

    } catch (error) {
      logger.error('Failed to get experiment summary', {
        experimentKey,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Helper: Get bucket key for time grouping
   */
  private getBucketKey(date: Date, interval: 'hour' | 'day' | 'week'): string {
    const d = new Date(date)
    switch (interval) {
      case 'hour':
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`
      case 'day':
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      case 'week':
        const weekNum = Math.floor(d.getDate() / 7)
        return `${d.getFullYear()}-${d.getMonth()}-${weekNum}`
      default:
        return date.toISOString()
    }
  }

  /**
   * Helper: Get bucket date (normalized to interval start)
   */
  private getBucketDate(date: Date, interval: 'hour' | 'day' | 'week'): Date {
    const d = new Date(date)
    switch (interval) {
      case 'hour':
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0)
      case 'day':
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
      case 'week':
        const dayOfWeek = d.getDay()
        const weekStart = new Date(d)
        weekStart.setDate(d.getDate() - dayOfWeek)
        return new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 0, 0, 0, 0)
      default:
        return d
    }
  }

  /**
   * Helper: Calculate chi-square p-value (approximation)
   */
  private chiSquarePValue(chiSquare: number, df: number): number {
    // Simplified approximation - for production use a proper statistical library
    // This uses a normal approximation for large df
    if (df <= 0) return 1

    const mean = df
    const variance = 2 * df
    const z = (chiSquare - mean) / Math.sqrt(variance)

    // Convert to p-value using standard normal CDF
    return 1 - this.normalCDF(z)
  }

  /**
   * Helper: Standard normal CDF approximation
   */
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)))
  }

  /**
   * Helper: Error function approximation
   */
  private erf(x: number): number {
    const a1 =  0.254829592
    const a2 = -0.284496736
    const a3 =  1.421413741
    const a4 = -1.453152027
    const a5 =  1.061405429
    const p  =  0.3275911

    const sign = x >= 0 ? 1 : -1
    x = Math.abs(x)

    const t = 1.0 / (1.0 + p * x)
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

    return sign * y
  }
}

// Singleton instance
export const experimentQueries = new ExperimentQueries()
