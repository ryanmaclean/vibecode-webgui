import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/server-monitoring';

const prisma = new PrismaClient();

interface AssignmentBuffer {
  experimentKey: string;
  userId: string;
  variantKey: string;
  metadata?: any;
}

interface MetricBuffer {
  experimentKey: string;
  userId: string;
  metricName: string;
  value: number;
  metadata?: any;
}

export class ExperimentWarehouse {
  private assignmentBuffer: AssignmentBuffer[] = [];
  private metricBuffer: MetricBuffer[] = [];
  private readonly BATCH_SIZE = 100;
  private flushTimer?: NodeJS.Timeout;
  private isStopping = false;

  constructor() {
    // Auto-flush every 5 seconds
    this.flushTimer = setInterval(() => {
      this.flush().catch(err => {
        logger.error('Auto-flush failed', { error: err.message });
      });
    }, 5000);
  }

  /**
   * Log experiment assignment - buffered for batch processing
   */
  async logAssignment(
    experimentKey: string,
    userId: string,
    variantKey: string,
    metadata?: any
  ): Promise<void> {
    this.assignmentBuffer.push({
      experimentKey,
      userId,
      variantKey,
      metadata
    });

    // Auto-flush if batch size reached
    if (this.assignmentBuffer.length >= this.BATCH_SIZE) {
      await this.flushAssignments();
    }
  }

  /**
   * Log metric event - buffered for batch processing
   */
  async logMetric(
    experimentKey: string,
    userId: string,
    metricName: string,
    value: number,
    metadata?: any
  ): Promise<void> {
    this.metricBuffer.push({
      experimentKey,
      userId,
      metricName,
      value,
      metadata
    });

    // Auto-flush if batch size reached
    if (this.metricBuffer.length >= this.BATCH_SIZE) {
      await this.flushMetrics();
    }
  }

  /**
   * Get assignments for an experiment
   */
  async getAssignments(experimentKey: string): Promise<any[]> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        assignments: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    return experiment?.assignments || [];
  }

  /**
   * Get metrics for an experiment
   */
  async getMetrics(experimentKey: string, metricName?: string): Promise<any[]> {
    const whereClause: any = { key: experimentKey };
    const metricsWhere: any = metricName ? { metric_name: metricName } : {};

    const experiment = await prisma.experiment.findUnique({
      where: whereClause,
      include: {
        metrics: {
          where: metricsWhere,
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    return experiment?.metrics || [];
  }

  /**
   * Get aggregated experiment results
   */
  async getExperimentResults(experimentKey: string): Promise<any> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        assignments: true,
        metrics: true
      }
    });

    if (!experiment) {
      return {
        experiment: null,
        totalAssignments: 0,
        totalMetricEvents: 0,
        variantDistribution: {},
        metrics: {}
      };
    }

    // Calculate variant distribution
    const variantDistribution: Record<string, number> = {};
    for (const assignment of experiment.assignments) {
      const variant = (assignment as any).variant_key;
      variantDistribution[variant] = (variantDistribution[variant] || 0) + 1;
    }

    // Calculate metric statistics per variant
    const metrics: Record<string, any> = {};
    for (const metric of experiment.metrics) {
      const m = metric as any;
      const key = `${m.variant_key || 'control'}_${m.metric_name}`;

      if (!metrics[key]) {
        metrics[key] = {
          count: 0,
          sum: 0,
          min: Infinity,
          max: -Infinity,
          values: []
        };
      }

      metrics[key].count++;
      metrics[key].sum += m.value;
      metrics[key].min = Math.min(metrics[key].min, m.value);
      metrics[key].max = Math.max(metrics[key].max, m.value);
      metrics[key].values.push(m.value);
    }

    // Calculate means
    for (const key in metrics) {
      metrics[key].mean = metrics[key].sum / metrics[key].count;
      delete metrics[key].values;
      delete metrics[key].sum;
    }

    return {
      experiment,
      totalAssignments: experiment.assignments.length,
      totalMetricEvents: experiment.metrics.length,
      variantDistribution,
      metrics
    };
  }

  /**
   * Upsert experiment
   */
  async upsertExperiment(
    key: string,
    name: string,
    config: any,
    hypothesis?: string,
    status?: string
  ): Promise<any> {
    return await prisma.experiment.upsert({
      where: { key },
      update: {
        name,
        config,
        hypothesis,
        status: status || 'draft'
      },
      create: {
        key,
        name,
        config,
        hypothesis,
        status: status || 'draft'
      }
    });
  }

  /**
   * Flush all buffers
   */
  async flush(): Promise<void> {
    await Promise.all([
      this.flushAssignments(),
      this.flushMetrics()
    ]);
  }

  /**
   * Flush assignment buffer
   */
  private async flushAssignments(): Promise<void> {
    if (this.assignmentBuffer.length === 0) return;

    const toFlush = [...this.assignmentBuffer];
    this.assignmentBuffer = [];

    try {
      // Group by experiment
      const byExperiment = new Map<string, AssignmentBuffer[]>();
      for (const assignment of toFlush) {
        const list = byExperiment.get(assignment.experimentKey) || [];
        list.push(assignment);
        byExperiment.set(assignment.experimentKey, list);
      }

      // Process each experiment
      for (const [experimentKey, assignments] of byExperiment.entries()) {
        const experiment = await prisma.experiment.findUnique({
          where: { key: experimentKey }
        });

        if (!experiment) {
          logger.warn('Experiment not found for assignment flush', { experimentKey });
          continue;
        }

        // Upsert each assignment
        for (const assignment of assignments) {
          await prisma.experimentAssignment.upsert({
            where: {
              experiment_id_user_id: {
                experimentId: experiment.id,
                userId: assignment.userId
              }
            },
            update: {
              variantKey: assignment.variantKey,
              metadata: assignment.metadata
            },
            create: {
              experimentId: experiment.id,
              userId: assignment.userId,
              variantKey: assignment.variantKey,
              metadata: assignment.metadata
            }
          });
        }
      }
    } catch (error) {
      logger.error('Failed to flush assignments', { error: (error as Error).message });
      // Re-add to buffer if flush failed
      this.assignmentBuffer.unshift(...toFlush);
    }
  }

  /**
   * Flush metrics buffer
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricBuffer.length === 0) return;

    const toFlush = [...this.metricBuffer];
    this.metricBuffer = [];

    try {
      // Group by experiment
      const byExperiment = new Map<string, MetricBuffer[]>();
      for (const metric of toFlush) {
        const list = byExperiment.get(metric.experimentKey) || [];
        list.push(metric);
        byExperiment.set(metric.experimentKey, list);
      }

      // Process each experiment
      for (const [experimentKey, metrics] of byExperiment.entries()) {
        const experiment = await prisma.experiment.findUnique({
          where: { key: experimentKey },
          include: { assignments: true }
        });

        if (!experiment) {
          logger.warn('Experiment not found for metric flush', { experimentKey });
          continue;
        }

        // Create metrics
        const metricData = metrics.map(m => {
          // Find assignment for this user
          const assignment = experiment.assignments.find(
            (a: any) => a.user_id === m.userId
          );

          return {
            experimentId: experiment.id,
            assignmentId: assignment?.id || '',
            metricName: m.metricName,
            metricValue: m.value,
            metadata: m.metadata
          };
        });

        await prisma.experimentMetric.createMany({
          data: metricData,
          skipDuplicates: true
        });
      }
    } catch (error) {
      logger.error('Failed to flush metrics', { error: (error as Error).message });
      // Re-add to buffer if flush failed
      this.metricBuffer.unshift(...toFlush);
    }
  }

  /**
   * Stop the warehouse and flush all pending data
   */
  async stop(): Promise<void> {
    if (this.isStopping) return;
    this.isStopping = true;

    // Stop auto-flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush all pending data
    await this.flush();
  }

  // Legacy methods for backward compatibility
  async createExperiment(data: {
    key: string;
    name: string;
    description?: string;
    config: any;
  }) {
    return await prisma.experiment.create({ data });
  }

  async updateExperimentStatus(
    experimentId: string,
    status: 'DRAFT' | 'REVIEW' | 'RUNNING' | 'COMPLETED' | 'ARCHIVED'
  ) {
    const updateData: any = { status };
    if (status === 'RUNNING') updateData.startedAt = new Date();
    if (status === 'COMPLETED') updateData.completedAt = new Date();

    return await prisma.experiment.update({
      where: { id: experimentId },
      data: updateData
    });
  }

  async getExperiment(key: string) {
    return await prisma.experiment.findUnique({ where: { key } });
  }

  async listExperiments(status?: 'RUNNING' | 'COMPLETED' | 'DRAFT') {
    return await prisma.experiment.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' }
    });
  }

  async getExperimentAssignments(experimentId: string) {
    return await prisma.experimentAssignment.groupBy({
      by: ['variantKey'],
      where: { experimentId },
      _count: { id: true }
    });
  }

  async getMetricAggregations(experimentId: string, metricName: string) {
    const metrics = await prisma.experimentMetric.findMany({
      where: { experimentId, metricName },
      include: { assignment: true }
    });

    const byVariant = metrics.reduce((acc, m) => {
      const variant = (m.assignment as any).variantKey;
      if (!acc[variant]) acc[variant] = [];
      acc[variant].push(m.metricValue);
      return acc;
    }, {} as Record<string, number[]>);

    return byVariant;
  }
}

export const warehouse = new ExperimentWarehouse();
export const experimentWarehouse = warehouse;
