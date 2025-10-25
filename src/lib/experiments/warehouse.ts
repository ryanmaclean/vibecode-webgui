/**
 * Experiment Data Warehouse Layer
 *
 * PostgreSQL-based assignment logging and metrics tracking following Eppo's pattern.
 * Implements batch processing for high-volume logging and efficient querying.
 *
 * Key Features:
 * - Assignment logging: Track which user received which variant
 * - Metric logging: Record conversion events and metrics
 * - Batch processing: Buffer events and flush periodically (100 events / 5s)
 * - Efficient indexing: Optimized for common query patterns
 */

import { PrismaClient } from '@prisma/client'
import { logger, appLogger } from '@/lib/server-monitoring'

const prisma = new PrismaClient()

/**
 * Assignment record representing a user's variant allocation
 */
export interface Assignment {
  experimentKey: string
  userId: string
  variantKey: string
  metadata?: Record<string, any>
  timestamp?: Date
}

/**
 * Metric event for tracking experiment outcomes
 */
export interface MetricEvent {
  experimentKey: string
  userId: string
  metricName: string
  value: number
  metadata?: Record<string, any>
  timestamp?: Date
}

/**
 * Aggregated experiment results
 */
export interface ExperimentResults {
  experiment: {
    id: string
    key: string
    name: string
    status: string
    config: any
  } | null
  variantDistribution: Record<string, number>
  metrics: Record<string, VariantMetricStats>
  totalAssignments: number
  totalMetricEvents: number
}

/**
 * Metric statistics per variant
 */
export interface VariantMetricStats {
  count: number
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
 * Batch buffer for high-throughput logging
 */
interface BatchBuffer<T> {
  items: T[]
  lastFlush: number
}

/**
 * Experiment Data Warehouse Client
 *
 * Provides methods for logging assignments and metrics with batch processing
 * to handle high-volume traffic efficiently.
 */
export class ExperimentWarehouse {
  private assignmentBuffer: BatchBuffer<Assignment>
  private metricBuffer: BatchBuffer<MetricEvent>
  private readonly BATCH_SIZE = 100
  private readonly FLUSH_INTERVAL_MS = 5000
  private flushTimer: NodeJS.Timeout | null = null

  constructor() {
    this.assignmentBuffer = { items: [], lastFlush: Date.now() }
    this.metricBuffer = { items: [], lastFlush: Date.now() }

    // Start periodic flush
    this.startPeriodicFlush()
  }

  /**
   * Log an experiment assignment
   *
   * Records which variant a user was assigned to for an experiment.
   * Uses batch processing to optimize database writes.
   *
   * @param experimentKey - Unique experiment identifier
   * @param userId - User identifier
   * @param variantKey - Variant assigned to user
   * @param metadata - Optional metadata (context, attributes, etc.)
   */
  async logAssignment(
    experimentKey: string,
    userId: string,
    variantKey: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const assignment: Assignment = {
      experimentKey,
      userId,
      variantKey,
      metadata,
      timestamp: new Date()
    }

    this.assignmentBuffer.items.push(assignment)

    // Flush if batch size reached
    if (this.assignmentBuffer.items.length >= this.BATCH_SIZE) {
      await this.flushAssignments()
    }

    appLogger.logBusiness('assignment_logged', {
      feature: 'experimentation',
      userId,
      metadata: {
        experimentKey,
        variantKey,
        buffered: true,
        bufferSize: this.assignmentBuffer.items.length
      }
    })
  }

  /**
   * Log a metric event
   *
   * Records a metric event (conversion, revenue, etc.) for analysis.
   * Uses batch processing for high-volume metrics.
   *
   * @param experimentKey - Unique experiment identifier
   * @param userId - User identifier
   * @param metricName - Metric name (e.g., 'conversion', 'revenue')
   * @param value - Metric value
   * @param metadata - Optional metadata
   */
  async logMetric(
    experimentKey: string,
    userId: string,
    metricName: string,
    value: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const metric: MetricEvent = {
      experimentKey,
      userId,
      metricName,
      value,
      metadata,
      timestamp: new Date()
    }

    this.metricBuffer.items.push(metric)

    // Flush if batch size reached
    if (this.metricBuffer.items.length >= this.BATCH_SIZE) {
      await this.flushMetrics()
    }

    appLogger.logBusiness('metric_logged', {
      feature: 'experimentation',
      userId,
      value,
      metadata: {
        experimentKey,
        metricName,
        buffered: true,
        bufferSize: this.metricBuffer.items.length
      }
    })
  }

  /**
   * Get all assignments for an experiment
   *
   * @param experimentKey - Unique experiment identifier
   * @returns Array of assignment records
   */
  async getAssignments(experimentKey: string): Promise<any[]> {
    try {
      // Ensure pending assignments are flushed
      await this.flushAssignments()

      const experiment = await prisma.experiment.findUnique({
        where: { key: experimentKey },
        include: {
          assignments: {
            orderBy: { timestamp: 'desc' }
          }
        }
      })

      return experiment?.assignments || []
    } catch (error) {
      logger.error('Failed to get assignments', {
        experimentKey,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Get metrics for an experiment
   *
   * @param experimentKey - Unique experiment identifier
   * @param metricName - Optional metric name filter
   * @returns Array of metric records
   */
  async getMetrics(experimentKey: string, metricName?: string): Promise<any[]> {
    try {
      // Ensure pending metrics are flushed
      await this.flushMetrics()

      const experiment = await prisma.experiment.findUnique({
        where: { key: experimentKey },
        include: {
          metrics: {
            where: metricName ? { metric_name: metricName } : undefined,
            orderBy: { timestamp: 'desc' }
          }
        }
      })

      return experiment?.metrics || []
    } catch (error) {
      logger.error('Failed to get metrics', {
        experimentKey,
        metricName,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Get aggregated experiment results
   *
   * Returns variant distribution, metric aggregations, and statistical analysis.
   *
   * @param experimentKey - Unique experiment identifier
   * @returns Aggregated experiment results
   */
  async getExperimentResults(experimentKey: string): Promise<ExperimentResults> {
    try {
      // Flush pending data
      await this.flush()

      const experiment = await prisma.experiment.findUnique({
        where: { key: experimentKey },
        include: {
          assignments: true,
          metrics: true
        }
      })

      if (!experiment) {
        return {
          experiment: null,
          variantDistribution: {},
          metrics: {},
          totalAssignments: 0,
          totalMetricEvents: 0
        }
      }

      // Calculate variant distribution
      const variantDistribution: Record<string, number> = {}
      for (const assignment of experiment.assignments) {
        const variant = assignment.variant_key
        variantDistribution[variant] = (variantDistribution[variant] || 0) + 1
      }

      // Aggregate metrics by variant
      const metricsByVariant: Record<string, Record<string, number[]>> = {}

      for (const metric of experiment.metrics) {
        const variant = metric.variant_key
        const metricName = metric.metric_name

        if (!metricsByVariant[variant]) {
          metricsByVariant[variant] = {}
        }
        if (!metricsByVariant[variant][metricName]) {
          metricsByVariant[variant][metricName] = []
        }

        metricsByVariant[variant][metricName].push(metric.value)
      }

      // Calculate statistics for each variant's metrics
      const metrics: Record<string, VariantMetricStats> = {}

      for (const [variant, metricData] of Object.entries(metricsByVariant)) {
        for (const [metricName, values] of Object.entries(metricData)) {
          const key = `${variant}_${metricName}`
          metrics[key] = this.calculateStats(values)
        }
      }

      return {
        experiment: {
          id: experiment.id,
          key: experiment.key,
          name: experiment.name,
          status: experiment.status,
          config: experiment.config
        },
        variantDistribution,
        metrics,
        totalAssignments: experiment.assignments.length,
        totalMetricEvents: experiment.metrics.length
      }

    } catch (error) {
      logger.error('Failed to get experiment results', {
        experimentKey,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Create or update an experiment
   *
   * @param key - Unique experiment identifier
   * @param name - Experiment name
   * @param config - Experiment configuration (variants, metrics, etc.)
   * @param hypothesis - Optional hypothesis statement
   * @param status - Experiment status
   */
  async upsertExperiment(
    key: string,
    name: string,
    config: any,
    hypothesis?: string,
    status: string = 'draft'
  ): Promise<any> {
    try {
      return await prisma.experiment.upsert({
        where: { key },
        update: {
          name,
          config,
          hypothesis,
          status,
          updated_at: new Date()
        },
        create: {
          key,
          name,
          config,
          hypothesis,
          status
        }
      })
    } catch (error) {
      logger.error('Failed to upsert experiment', {
        key,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Flush all buffered data
   */
  async flush(): Promise<void> {
    await Promise.all([
      this.flushAssignments(),
      this.flushMetrics()
    ])
  }

  /**
   * Flush buffered assignments to database
   */
  private async flushAssignments(): Promise<void> {
    if (this.assignmentBuffer.items.length === 0) return

    const assignments = [...this.assignmentBuffer.items]
    this.assignmentBuffer.items = []
    this.assignmentBuffer.lastFlush = Date.now()

    try {
      // Group by experiment key for efficiency
      const byExperiment = new Map<string, Assignment[]>()
      for (const assignment of assignments) {
        if (!byExperiment.has(assignment.experimentKey)) {
          byExperiment.set(assignment.experimentKey, [])
        }
        byExperiment.get(assignment.experimentKey)!.push(assignment)
      }

      // Process each experiment's assignments
      for (const [experimentKey, expAssignments] of byExperiment) {
        // Ensure experiment exists
        const experiment = await prisma.experiment.findUnique({
          where: { key: experimentKey }
        })

        if (!experiment) {
          logger.warn('Experiment not found for assignments', { experimentKey })
          continue
        }

        // Batch insert assignments (upsert to handle duplicates)
        await Promise.all(
          expAssignments.map(assignment =>
            prisma.experimentAssignment.upsert({
              where: {
                experiment_id_user_id: {
                  experiment_id: experiment.id,
                  user_id: assignment.userId
                }
              },
              update: {
                variant_key: assignment.variantKey,
                metadata: assignment.metadata || {},
                timestamp: assignment.timestamp || new Date()
              },
              create: {
                experiment_id: experiment.id,
                user_id: assignment.userId,
                variant_key: assignment.variantKey,
                metadata: assignment.metadata || {},
                timestamp: assignment.timestamp || new Date()
              }
            })
          )
        )
      }

      appLogger.logBusiness('assignments_flushed', {
        feature: 'experimentation',
        metadata: {
          count: assignments.length,
          experiments: byExperiment.size
        }
      })

    } catch (error) {
      logger.error('Failed to flush assignments', {
        count: assignments.length,
        error: (error as Error).message
      })
      // Re-add failed assignments to buffer for retry
      this.assignmentBuffer.items.unshift(...assignments)
    }
  }

  /**
   * Flush buffered metrics to database
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricBuffer.items.length === 0) return

    const metrics = [...this.metricBuffer.items]
    this.metricBuffer.items = []
    this.metricBuffer.lastFlush = Date.now()

    try {
      // Group by experiment key
      const byExperiment = new Map<string, MetricEvent[]>()
      for (const metric of metrics) {
        if (!byExperiment.has(metric.experimentKey)) {
          byExperiment.set(metric.experimentKey, [])
        }
        byExperiment.get(metric.experimentKey)!.push(metric)
      }

      // Process each experiment's metrics
      for (const [experimentKey, expMetrics] of byExperiment) {
        // Ensure experiment exists
        const experiment = await prisma.experiment.findUnique({
          where: { key: experimentKey },
          include: { assignments: true }
        })

        if (!experiment) {
          logger.warn('Experiment not found for metrics', { experimentKey })
          continue
        }

        // Create assignment lookup
        const assignmentsByUser = new Map(
          experiment.assignments.map(a => [a.user_id, a])
        )

        // Batch insert metrics
        await prisma.experimentMetric.createMany({
          data: expMetrics.map(metric => {
            const assignment = assignmentsByUser.get(metric.userId)
            return {
              experiment_id: experiment.id,
              assignment_id: assignment?.id,
              user_id: metric.userId,
              variant_key: assignment?.variant_key || 'unknown',
              metric_name: metric.metricName,
              value: metric.value,
              metadata: metric.metadata || {},
              timestamp: metric.timestamp || new Date()
            }
          }),
          skipDuplicates: true
        })
      }

      appLogger.logBusiness('metrics_flushed', {
        feature: 'experimentation',
        metadata: {
          count: metrics.length,
          experiments: byExperiment.size
        }
      })

    } catch (error) {
      logger.error('Failed to flush metrics', {
        count: metrics.length,
        error: (error as Error).message
      })
      // Re-add failed metrics to buffer for retry
      this.metricBuffer.items.unshift(...metrics)
    }
  }

  /**
   * Start periodic flush timer
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        logger.error('Periodic flush failed', {
          error: (error as Error).message
        })
      })
    }, this.FLUSH_INTERVAL_MS)

    // Ensure timer doesn't prevent process exit
    if (this.flushTimer.unref) {
      this.flushTimer.unref()
    }
  }

  /**
   * Stop periodic flush and flush remaining data
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    await this.flush()
  }

  /**
   * Calculate statistical metrics for a set of values
   */
  private calculateStats(values: number[]): VariantMetricStats {
    if (values.length === 0) {
      return {
        count: 0,
        mean: 0,
        median: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
        stdDev: 0
      }
    }

    const sorted = [...values].sort((a, b) => a - b)
    const count = sorted.length
    const sum = sorted.reduce((acc, v) => acc + v, 0)
    const mean = sum / count

    // Variance and standard deviation
    const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count
    const stdDev = Math.sqrt(variance)

    // Percentiles
    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * count) - 1
      return sorted[Math.max(0, Math.min(index, count - 1))]
    }

    return {
      count,
      mean,
      median: percentile(50),
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
      min: sorted[0],
      max: sorted[count - 1],
      stdDev
    }
  }
}

// Singleton instance
export const experimentWarehouse = new ExperimentWarehouse()

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await experimentWarehouse.stop()
  })
}
